// customLedgers (kind='deposit') → সরাসরি বিদ্যমান FundDetailScreen reuse, শুধু সেই fundId-তে filter/open করে।
// নতুন কোনো calc/engine নেই — Home Deposit-এর সাথে হুবহু একই depositFunds/homeDeposits ব্যবহার হয়।
import FullScreenPage from '../../common/FullScreenPage';
import SkeletonLoader from '../../common/SkeletonLoader';
import FundDetailScreen from './FundDetailScreen';
import { useFunds, useHomeDeposits } from '../../../hooks/useData';

export default function CustomDepositLedgerScreen({
  uid,
  fundId,
  title,
  onBack,
}: {
  uid: string;
  fundId: string;
  title: string;
  onBack: () => void;
}) {
  const funds = useFunds(uid);
  const entries = useHomeDeposits(uid);

  const loading = funds.state.status === 'loading' || entries.state.status === 'loading';
  const fund = funds.state.status === 'ready' ? funds.state.data.find((f) => f.id === fundId) : undefined;

  if (loading) {
    return (
      <FullScreenPage title={title} onBack={onBack}>
        <SkeletonLoader />
      </FullScreenPage>
    );
  }

  if (!fund) {
    return (
      <FullScreenPage title={title} onBack={onBack}>
        <p className="py-10 text-center text-muted">Couldn’t find this ledger’s fund.</p>
      </FullScreenPage>
    );
  }

  const entryList = entries.state.status === 'ready' ? entries.state.data.filter((e) => e.fundId === fundId) : [];
  return <FundDetailScreen uid={uid} fund={fund} entries={entryList} onBack={onBack} />;
}
