# sympy/sympy #28109 — [Ring Series]: New series module supporting truncated power series rings over ZZ and QQ with Python and FLINT backends

**[View PR on GitHub](https://github.com/sympy/sympy/pull/28109)**

| | |
|---|---|
| **Author** | @Jatinbhardwaj-093 |
| **Status** | Merged (by oscarbenjamin on Jul 27, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @oscarbenjamin
> Every function is converting with `to_list`. If we want to use the `dup_*` functions then it is better to work with the `dup` representation directly i.e. just use a list of domain elements rather than DMP or DMP_Python.

### @oscarbenjamin
> I'm also unsure how this is intended to fit with using python-flint's series types when available. How would they fit into this design?

### @oscarbenjamin
> Since there are several modules now I think it would be best to have a `sympy/polys/series` package and put them all in there.

### @oscarbenjamin
> Distinguishing between exact polynomials and approximate truncated series...should use a special value for the prec that can indicate that a series is exact. Possibly a value of None should be used for this.

### @oscarbenjamin
> This is the only `Any` remaining in `sympy.polys.series`. It should be `Er`.

### @oscarbenjamin
> The protocol does not define `__call__`: ... R.print(R([1, 2])) # type checker errors here

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
