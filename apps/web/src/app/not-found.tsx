import { Compass } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <EmptyState
        icon={Compass}
        title="This page doesn't exist"
        hint="The link may be broken or the record was deleted."
        action={
          <Button asChild size="sm">
            <Link href="/today">Back to Today</Link>
          </Button>
        }
      />
    </div>
  );
}
