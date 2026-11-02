import Link from "next/link";
import { PackageX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";

export default function ProductNotFound() {
  return (
    <div className="container mx-auto px-4 py-20 flex justify-center">
      <Empty
        icon={<PackageX className="size-8" />}
        title="Product Not Found"
        description="The product you are looking for may have been retired, moved, or is temporarily unavailable."
        action={
          <Button asChild>
            <Link href="/products">Browse Catalog</Link>
          </Button>
        }
      />
    </div>
  );
}
