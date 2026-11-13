import {
  MASKED_TEAM_NAME,
  QUESTION_MARK_TEAM_LOGO,
  displayMatchTeamName,
  presentTeamLogo,
} from '../maskedNationalTeam';

const ISRAEL_LOGO =
  'https://imagecache.365scores.com/image/upload/f_png,w_68,h_68,c_limit,q_auto:eco,dpr_2/v3/Competitors/5034';

describe('maskedNationalTeam', () => {
  it('shows the senior national team as unknown with a question-mark crest', () => {
    expect(displayMatchTeamName('Israel', 'ar', 5034, ISRAEL_LOGO)).toBe(MASKED_TEAM_NAME);
    expect(displayMatchTeamName('Israel', 'en')).toBe('Unknown');
    expect(presentTeamLogo('Israel', ISRAEL_LOGO, 5034)).toBe(QUESTION_MARK_TEAM_LOGO);
    expect(QUESTION_MARK_TEAM_LOGO.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('leaves Kosovo, youth teams, and Northern Ireland alone', () => {
    expect(displayMatchTeamName('Kosovo', 'en')).toBe('Kosovo');
    expect(presentTeamLogo('Kosovo', 'https://cdn.example/kosovo.png')).toBe(
      'https://cdn.example/kosovo.png',
    );
    expect(displayMatchTeamName('Israel U21', 'ar')).toBe('Israel U21');
    expect(displayMatchTeamName('Northern Ireland', 'en')).toBe('Northern Ireland');
  });
});
