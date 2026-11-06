import { redirect } from "next/navigation";

export default function LoyaltyTelegramRedirectPage() {
  redirect("/loyalty/guest-verification");
}
