/**
 * Share & Win route — /share-win
 *
 * The screen lives in components/ShareWin so the route stays a thin entry
 * point, matching how quiz/[mode] delegates to its hub screen.
 *
 * `LuckyWheelCard` stays imported here so Fast Refresh does not crash with
 * `Property 'LuckyWheelCard' doesn't exist` after the wheel was removed from
 * the page. It is never mounted.
 */

import LuckyWheelCard from '../../components/ShareWin/components/LuckyWheelCard';
import ShareWinScreen from '../../components/ShareWin/ShareWinScreen';

export default function ShareWinRoute() {
  return (
    <>
      {false ? <LuckyWheelCard onSpinSettled={() => undefined} /> : null}
      <ShareWinScreen />
    </>
  );
}
