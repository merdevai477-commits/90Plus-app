package expo.modules.widgetbridge

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/** Crests and player photos, downsampled and cached on disk so cached renders skip the network. */
internal object WidgetImages {
  /** RemoteViews ship bitmaps over binder; keep each one small. */
  private const val MAX_PX = 96
  /** Stadium backdrops span the whole card but sit under a dark scrim, so modest detail is enough. */
  const val COVER_PX = 560

  private fun dir(context: Context): File =
    File(context.cacheDir, "np_widget_images").apply { mkdirs() }

  private fun fileFor(context: Context, url: String, maxPx: Int): File {
    val key = if (maxPx == MAX_PX) url else "$url#$maxPx"
    val digest = MessageDigest.getInstance("SHA-256").digest(key.toByteArray())
    return File(dir(context), digest.joinToString("") { "%02x".format(it) } + if (maxPx == MAX_PX) ".png" else ".jpg")
  }

  fun load(context: Context, url: String?, allowNetwork: Boolean, maxPx: Int = MAX_PX): Bitmap? {
    if (url.isNullOrBlank()) return null
    val file = fileFor(context, url, maxPx)
    if (file.exists()) {
      BitmapFactory.decodeFile(file.absolutePath)?.let { return it }
    }
    if (!allowNetwork) return null
    val bytes = download(url) ?: return null
    val bitmap = decodeScaled(bytes, maxPx) ?: return null
    try {
      val format = if (maxPx == MAX_PX) Bitmap.CompressFormat.PNG else Bitmap.CompressFormat.JPEG
      file.outputStream().use { bitmap.compress(format, 85, it) }
    } catch (_: Exception) {
      // Cache write is best-effort.
    }
    return bitmap
  }

  /**
   * Centre-crops [source] to the card's aspect, rounds it to the card corners and darkens it
   * (more towards the bottom) so white text stays readable on any stadium photo.
   */
  fun cover(source: Bitmap, aspect: Float, radiusFraction: Float): Bitmap {
    val width = minOf(source.width, COVER_PX)
    val height = (width / aspect).toInt().coerceAtLeast(1)
    val out = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(out)
    val scale = maxOf(width.toFloat() / source.width, height.toFloat() / source.height)
    val matrix = android.graphics.Matrix().apply {
      setScale(scale, scale)
      postTranslate((width - source.width * scale) / 2f, (height - source.height * scale) / 2f)
    }
    val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
      shader = BitmapShader(source, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).also { it.setLocalMatrix(matrix) }
    }
    val radius = width * radiusFraction
    val rect = RectF(0f, 0f, width.toFloat(), height.toFloat())
    canvas.drawRoundRect(rect, radius, radius, paint)
    val scrim = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      shader = android.graphics.LinearGradient(
        0f, 0f, 0f, height.toFloat(),
        intArrayOf(0xB30D0A14.toInt(), 0x990D0A14.toInt(), 0xF20D0A14.toInt()),
        floatArrayOf(0f, 0.45f, 1f),
        Shader.TileMode.CLAMP,
      )
    }
    canvas.drawRoundRect(rect, radius, radius, scrim)
    return out
  }

  fun circle(source: Bitmap): Bitmap {
    val size = minOf(source.width, source.height)
    val out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      shader = BitmapShader(source, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).also { shader ->
        val matrix = android.graphics.Matrix()
        matrix.setTranslate(-(source.width - size) / 2f, 0f)
        shader.setLocalMatrix(matrix)
      }
    }
    Canvas(out).drawOval(RectF(0f, 0f, size.toFloat(), size.toFloat()), paint)
    return out
  }

  private fun download(url: String): ByteArray? {
    var connection: HttpURLConnection? = null
    return try {
      connection = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 8_000
        readTimeout = 8_000
        // Wikimedia (stadium photos) rejects anonymous clients.
        setRequestProperty("User-Agent", "90PlusWidget/1.0 (https://90plus.pro)")
      }
      if (connection.responseCode !in 200..299) null else connection.inputStream.use { it.readBytes() }
    } catch (_: Exception) {
      null
    } finally {
      connection?.disconnect()
    }
  }

  private fun decodeScaled(bytes: ByteArray, maxPx: Int): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    var sample = 1
    while (bounds.outWidth / (sample * 2) >= maxPx && bounds.outHeight / (sample * 2) >= maxPx) sample *= 2
    val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
      ?: return null
    val scale = maxPx.toFloat() / maxOf(decoded.width, decoded.height)
    if (scale >= 1f) return decoded
    return Bitmap.createScaledBitmap(
      decoded,
      (decoded.width * scale).toInt().coerceAtLeast(1),
      (decoded.height * scale).toInt().coerceAtLeast(1),
      true,
    )
  }
}
