import Link from "next/link";
import { Users } from "lucide-react";
import { JoinGroupButton } from "@/components/group-forms";
import { Card } from "@/components/ui";
import { getInviteByToken } from "@/lib/groups";

export const metadata = { title: "Join group — FinTrack" };

export default async function JoinGroupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  return (
    <div className="mx-auto max-w-md pt-6">
      <Card>
        {invite ? (
          <div className="space-y-4 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <Users size={26} />
            </span>
            <div>
              <h1 className="break-words text-lg font-semibold text-ink-900">
                {invite.groupName}
              </h1>
              <p className="mt-1 text-sm text-ink-500">
                {invite.inviterName} invited{" "}
                <span className="break-all font-medium">{invite.email}</span> to
                this group of {invite.memberCount}.
              </p>
            </div>
            <JoinGroupButton token={token} />
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <h1 className="text-lg font-semibold text-ink-900">
              Invite not valid
            </h1>
            <p className="text-sm text-ink-500">
              This link has already been used or replaced by a newer invite. Ask
              the group to resend it.
            </p>
            <Link
              href="/groups"
              className="inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Go to your groups
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
