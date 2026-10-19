import { teamNamesLooselyMatch } from '../team-name-match.util';

describe('teamNamesLooselyMatch', () => {
  it('matches Al Ahly with Al Ahly SC', () => {
    expect(teamNamesLooselyMatch('Al Ahly', 'Al Ahly SC')).toBe(true);
    expect(teamNamesLooselyMatch('الأهلي', 'الأهلي المصري')).toBe(true);
  });

  it('does not treat National Bank as Al Ahly', () => {
    expect(teamNamesLooselyMatch('الأهلي', 'البنك الأهلي')).toBe(false);
    expect(teamNamesLooselyMatch('Al Ahly', 'National Bank')).toBe(false);
    expect(teamNamesLooselyMatch('البنك الأهلي', 'الأهلي')).toBe(false);
  });

  it('does not treat Shabab Al Ahli as Al Ahly', () => {
    expect(teamNamesLooselyMatch('الأهلي', 'شباب الأهلي')).toBe(false);
  });
});
