
'use client';

import { notFound, useParams } from 'next/navigation';
import { useGameStore } from '@/lib/store';
import { betTypes, type BetType } from '@/lib/types';
import { BettingForm } from './components/betting-form';
import { SinglePanaForm } from './components/single-pana-form';
import { JodiDigitForm } from './components/jodi-digit-form';
import { DoublePanaForm } from './components/double-pana-form';
import { TriplePanaForm } from './components/triple-pana-form';
import { HalfSangamForm } from './components/half-sangam-form';
import { FullSangamForm } from './components/full-sangam-form';
import { SinglePanaBulkForm } from './components/single-pana-bulk-form';
import { SingleDigitBulkForm } from './components/single-digit-bulk-form';
import { DoublePanaBulkForm } from './components/double-pana-bulk-form';
import { SpDpTpForm } from './components/sp-dp-tp-form';
import { SpMotorForm } from './components/sp-motor-form';
import { DpMotorForm } from './components/dp-motor-form';

export default function PlaceBetPage() {
  const params = useParams();

  const gameId = typeof params.game === 'string' ? params.game : '';
  const betType = typeof params.betType === 'string' && Object.keys(betTypes).includes(params.betType) ? params.betType as BetType : null;

  const game = useGameStore((state) => state.getGameById(gameId));
  
  // The parent layout now handles loading and 404 logic.
  // We can assume `game` will be present here.
  if (!game || !betType) {
    // This should technically not be reached if the layout works correctly,
    // but it's a safe fallback.
    notFound();
    return null;
  }

  const renderForm = () => {
    switch (betType) {
      case 'singlePana':
        return <SinglePanaForm game={game} betType={betType} />;
      case 'doublePana':
        return <DoublePanaForm game={game} betType={betType} />;
      case 'triplePana':
        return <TriplePanaForm game={game} betType={betType} />;
      case 'singleDigit':
        return <BettingForm game={game} betType={betType} />;
      case 'jodiDigit':
        return <JodiDigitForm game={game} betType={betType} />;
      case 'halfSangam':
        return <HalfSangamForm game={game} betType={betType} />;
      case 'fullSangam':
        return <FullSangamForm game={game} betType={betType} />;
      case 'singlePanaBulk':
        return <SinglePanaBulkForm game={game} betType={betType} />;
      case 'singleDigitBulk':
        return <SingleDigitBulkForm game={game} betType={betType} />;
      case 'doublePanaBulk':
        return <DoublePanaBulkForm game={game} betType={betType} />;
      case 'spDpTp':
        return <SpDpTpForm game={game} betType={betType} />;
      case 'spMotor':
        return <SpMotorForm game={game} betType={betType} />;
      case 'dpMotor':
        return <DpMotorForm game={game} betType={betType} />;
      default:
        // You can add more cases for other bet types here
        // For now, default to the original form or a placeholder
        return <BettingForm game={game} betType={betType} />;
    }
  };

  return (
    <main className="container mx-auto px-4 pt-4 pb-8 flex-1">
       <div className="max-w-sm mx-auto">
        {renderForm()}
      </div>
    </main>
  );
}
