# Google Accounts

Use the `googleAccounts` global to discover Google accounts signed in to the
current Safari session. Its methods are synchronous:

```js
googleAccounts.print()
```

`googleAccounts.print()` writes a concise account list. Use
`googleAccounts.list()` when programmatic access is required:

```js
var accounts = googleAccounts.list()
accounts
```

Each result contains `accountId`, `name`, `email`, and `profileImageUrl`.
`accountId` matches the account position commonly used in Google `/u/{id}/`
URLs.

Safari Apple Events does not expose its cookie store. Account discovery
therefore loads Google's sign-out options page in a temporary background tab
and closes that tab before returning. It does not require an existing Google
tab and never returns raw cookies.

Do not assume account `0` is the intended account. Match an email address the
user already specified. If the user asks for the current Google account, read
the visible account identity from the relevant Google tab and match it exactly
against `googleAccounts.list()`. Ask the user to choose before a consequential
action when the intended account remains ambiguous.

Account discovery does not sign in to arbitrary websites. A third-party site
must support Google OAuth, and any account selection or permission grant remains
a separate browser action.

Treat names, email addresses, and profile images as private information.
