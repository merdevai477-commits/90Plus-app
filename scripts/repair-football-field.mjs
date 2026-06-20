import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const target = path.join('front', 'components', 'match-details', 'FootballField.tsx');

function readUtf8FromGit(commit) {
  const buf = execSync(`git cat-file -p ${commit}:front/components/match-details/FootballField.tsx`);
  return buf.length > 2 && buf[1] === 0 ? buf.toString('utf16le') : buf.toString('utf8');
}

let source = fs.readFileSync(target);
let text =
  source.length > 2 && source[1] === 0 ? source.toString('utf16le') : source.toString('utf8');

if (!text.includes('export const FootballField')) {
  text = readUtf8FromGit('d24348a3f');
}

text = text
  .replaceAll('style={styles.', 'style={viewStyles.')
  .replaceAll('<View style={styles.', '<View style={viewStyles.')
  .replaceAll('style={[styles.', 'style={[viewStyles.')
  .replaceAll('style={styles.playerImage}', 'style={imageStyles.playerImage}')
  .replace(
    '<View style={[styles.playerImage, styles.placeholderParams]}>\n            <Text style={{ color: \'#fff\', fontSize: 14, fontWeight: \'bold\' }}>',
    '<View style={[imageStyles.playerImage, viewStyles.placeholderParams]}>\n            <Text style={textStyles.placeholderNumber}>',
  )
  .replace('<Text style={styles.formationLabel}>', '<Text style={textStyles.formationLabel}>')
  .replace('<Text style={styles.teamNameLabel}>', '<Text style={textStyles.teamNameLabel}>')
  .replace('<Text style={styles.playerNameText}', '<Text style={textStyles.playerNameText}')
  .replace('const styles = StyleSheet.create({', 'const viewStyles = StyleSheet.create({')
  .replace(
    `  fieldLines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.2,
  },`,
    `  fieldLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.2,
  },`,
  )
  .replace(
    `  cornerBR: { bottom: -15, right: -15, borderRadius: 15 },
  formationLabel: {
    position: 'absolute',
    top: 20,
    left: 20,
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  teamNameLabel: {
    position: 'absolute',
    top: 20,
    right: 20,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  playersContainer: {`,
    `  cornerBR: { bottom: -15, right: -15, borderRadius: 15 },
  playersContainer: {`,
  )
  .replace(
    `  placeholderParams: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  playerNameText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
});`,
    `  placeholderParams: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const imageStyles = StyleSheet.create({
  playerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
});

const textStyles = StyleSheet.create({
  formationLabel: {
    position: 'absolute',
    top: 20,
    left: 20,
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  teamNameLabel: {
    position: 'absolute',
    top: 20,
    right: 20,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  placeholderNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  playerNameText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
});`,
  );

fs.writeFileSync(target, text, 'utf8');
console.log('Repaired', target, 'bytes', fs.statSync(target).size);
