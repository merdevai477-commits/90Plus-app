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

  private fun dir(context: Context): File =
    File(context.cacheDir, "np_widget_images").apply { mkdirs() }

  private fun fileFor(context: Context, url: String): File {
    val digest = MessageDigest.getInstance("SHA-256").digest(url.toByteArray())
    return File(dir(context), digest.joinToString("") { "%02x".format(it) } + ".png")
  }

  fun load(context: Context, url: String?, allowNetwork: Boolean): Bitmap? {
    if (url.isNullOrBlank()) return null
    val file = fileFor(context, url)
    if (file.exists()) {
      BitmapFactory.decodeFile(file.absolutePath)?.let { return it }
    }
    if (!allowNetwork) return null
    val bytes = download(url) ?: return null
    val bitmap = decodeScaled(bytes) ?: return null
    try {
      file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    } catch (_: Exception) {
      // Cache write is best-effort.
    }
    return bitmap
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
      }
      if (connection.responseCode !in 200..299) null else connection.inputStream.use { it.readBytes() }
    } catch (_: Exception) {
      null
    } finally {
      connection?.disconnect()
    }
  }

  private fun decodeScaled(bytes: ByteArray): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    var sample = 1
    while (bounds.outWidth / (sample * 2) >= MAX_PX && bounds.outHeight / (sample * 2) >= MAX_PX) sample *= 2
    val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
      ?: return null
    val scale = MAX_PX.toFloat() / maxOf(decoded.width, decoded.height)
    if (scale >= 1f) return decoded
    return Bitmap.createScaledBitmap(
      decoded,
      (decoded.width * scale).toInt().coerceAtLeast(1),
      (decoded.height * scale).toInt().coerceAtLeast(1),
      true,
    )
  }
}
