import { mergeSafetyFlag } from '../community-safety-flag';

describe('mergeSafetyFlag', () => {
    it('sets NSFW on a clean account', () => {
        expect(mergeSafetyFlag(null, 'NSFW')).toBe('NSFW');
    });

    it('sets REPORTED on a clean account', () => {
        expect(mergeSafetyFlag(undefined, 'REPORTED')).toBe('REPORTED');
    });

    it('upgrades to NSFW_REPORTED when both happen', () => {
        expect(mergeSafetyFlag('REPORTED', 'NSFW')).toBe('NSFW_REPORTED');
        expect(mergeSafetyFlag('NSFW', 'REPORTED')).toBe('NSFW_REPORTED');
        expect(mergeSafetyFlag('NSFW_REPORTED', 'NSFW')).toBe('NSFW_REPORTED');
        expect(mergeSafetyFlag('NSFW_REPORTED', 'REPORTED')).toBe('NSFW_REPORTED');
    });
});
