import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "@/components/storefront/account-page";
import { pageHead } from "@/utils/page-head";

export const Route = createFileRoute("/account")({
  component: AccountPage,
  head: () =>
    pageHead(
      "Customer Account | The Gold Crown",
      "Sign in or register to manage orders, addresses, and wishlist at The Gold Crown.",
      "/account",
    ),
});
