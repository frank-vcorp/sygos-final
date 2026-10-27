import { ReportView } from "../report-view";

export default function ReportePage(props: { params: Promise<{ tipo: string }>; searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  return ReportView(props);
}
