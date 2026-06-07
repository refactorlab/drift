# sympy/sympy #27423 — Add Fraction-Free LU Decomposition for DomainMatrix

**[View PR on GitHub](https://github.com/sympy/sympy/pull/27423)**

| | |
|---|---|
| **Author** | @Ytemiloluwa |
| **Status** | Merged (March 5, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @oscarbenjamin
> I'm getting an error here... Type mismatch: <class 'sympy.polys.matrices.ddm.DDM'> * <class 'sympy.polys.matrices._dfm.DFM'>

### @oscarbenjamin
> When the SDM format is used the results returned by `fflu` should also be SDM

### @oscarbenjamin
> Various references for the algorithm were discussed but no references are given here in any of the docstrings

### @oscarbenjamin
> The `_fflu` method code is not in python-flint ... what is the code based on?

### @oscarbenjamin
> Are you saying that the code here was written by adapting what is shown on Wikipedia? The algorithm there looks very different from what is in the code here

### @oscarbenjamin
> Okay I think that the references to cite then are the Nakos paper and the one about PLDU/QRD decomposition

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
