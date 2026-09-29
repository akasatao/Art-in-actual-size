import WorkGrid from "@/components/WorkGrid";
import { works } from "@/lib/works";

export default function HomePage() {
  return <WorkGrid works={works} />;
}
