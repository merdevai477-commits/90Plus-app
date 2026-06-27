import { findCoachInLineup } from '../coach-lookup.service';

describe('findCoachInLineup', () => {
  it('يرجع head_coach لو formation.id === 16 موجود', () => {
    const members = [
      { id: 1, formation: { id: 17 } },
      { id: 2, formation: { id: 16 } },
      { id: 3, formation: { id: 1 } },
    ];
    
    const result = findCoachInLineup(members);
    
    expect(result).toEqual({
      member: { id: 2, formation: { id: 16 } },
      role: 'head_coach'
    });
  });

  it('يرجع assistant_coach كـ fallback لو 16 مش موجود و17 موجود', () => {
    const members = [
      { id: 1, formation: { id: 1 } },
      { id: 2, formation: { id: 17 } },
      { id: 3, formation: { id: 4 } },
    ];
    
    const result = findCoachInLineup(members);
    
    expect(result).toEqual({
      member: { id: 2, formation: { id: 17 } },
      role: 'assistant_coach'
    });
  });

  it('يرجع null لو مفيش 16 ولا 17 خالص', () => {
    const members = [
      { id: 1, formation: { id: 1 } },
      { id: 2, formation: { id: 2 } },
    ];
    
    const result = findCoachInLineup(members);
    
    expect(result).toBeNull();
  });
});
