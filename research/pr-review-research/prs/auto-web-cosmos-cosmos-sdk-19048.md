# cosmos/cosmos-sdk #19048 — feat(x/accounts): Add new lockup account type

**[View PR on GitHub](https://github.com/cosmos/cosmos-sdk/pull/19048)**

| | |
|---|---|
| **Author** | @sontrinh16 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @tac0turtle
> I think this is a 1:1 mapping when we don't necessarily want 1:1 mapping but a vesting account per existing vesting account. There is no base vesting account as that's a legacy notion.

### @tac0turtle
> Staking and bank shouldn't be imported in accounts as well. Let's hop on a call and quickly map out the design.

### @coderabbitai
> It would be beneficial to include comments or documentation directly in the code to explain the purpose and expected behavior of each account type.

### @coderabbitai
> The method is quite long and handles multiple responsibilities. Consider refactoring to improve readability and maintainability.

### @coderabbitai
> The method name should follow Go's naming conventions with camelCase. Consider renaming it to GetLockedCoinsWithDenoms for consistency.

### @coderabbitai
> Error messages for invalid period duration length do not include the actual length, which could aid in debugging.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
