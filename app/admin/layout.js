// Admin-only favicon override: the tab shows the UPSIDE-DOWN Main Event Studio
// logo so the owner can spot the admin tab at a glance (only the owner sees
// /admin). This nested-layout metadata overrides the root layout's icon for
// every /admin route.
export const metadata = {
  icons: {
    icon: '/favicon-admin.png',
    shortcut: '/favicon-admin.png',
    apple: '/favicon-admin.png',
  },
};

export default function AdminLayout({ children }) {
  return children;
}
