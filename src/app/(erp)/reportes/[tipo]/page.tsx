import { ReportView } from "../page";

export default function ReportePage(props: { params: Promise<{ tipo: string }>; searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  return ReportView(props);
}
