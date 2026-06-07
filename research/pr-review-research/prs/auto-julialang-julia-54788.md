# JuliaLang/julia #54788 — Refactor `Binding` data structures in preparation for partition

**[View PR on GitHub](https://github.com/JuliaLang/julia/pull/54788)**

| | |
|---|---|
| **Author** | @Keno |
| **Status** | ✅ merged |
| **Opened** | 2024-06-13 |
| **Repo importance** | ★48,772 · 5,785 forks · score 76,892 |
| **Diff** | +1031 / −542 across 30 files |
| **Engagement** | 25 conversation · 87 inline review comments |

## Top review comments (ranked by reactions)

### @nanosoldier — 0 reactions  
`—`  ·  [link](https://github.com/JuliaLang/julia/pull/54788#issuecomment-2194053465)

> The package evaluation job [you requested](https://github.com/JuliaLang/julia/pull/54788#issuecomment-2192662294) has completed - possible new issues were detected.
> The [**full report**](https://s3.amazonaws.com/julialang-reports/nanosoldier/pkgeval/by_hash/c2cc636_vs_14956a1/report.html) is available.

### @Keno — 0 reactions  
`—`  ·  [link](https://github.com/JuliaLang/julia/pull/54788#issuecomment-2194167482)

> @nanosoldier `runtests(["Tricks", "ComputationalResources", "ModuleInterfaceTools", "MultilineStrings", "ImportAll", "ForceImport", "InvariantsCore", "Syslogs", "TranscodingStreams", "EulerAngles", "MarkdownAST", "MD5", "StrFormat", "MiniLoggers", "JACC", "Invariants", "Automa", "BufferedStreams", "Setfield", "ClimaUtilities", "OctreeBH", "NonNegLeastSquaresMLJInterface", "HolidayCalendars", "KiwiConstraintSolver", "MixedStructTypes", "DistributedArrays", "MLJTSVDInterface", "HMMER", "CryptographicHashFunctions", "FASTX", "Neighborhood", "ShuffleProofs", "HOHQMesh", "Rocket", "JSON3", "TypedFASTX", "StrEntities", "OutlierDetectionTrees", "QuantumAlgebra", "SelfOrganizingMaps", "OneRule", "MLJDecisionTreeInterface", "LinearFold", "PAndQ", "ArtGallery", "OutlierDetectionNeighbors", "PkgJogger", "MultivariateMoments", "OnlineTechnicalIndicators", "ParallelKMeans", "ModuleInfo", "CharacteristicInvFourier", "MetaGraphsNext", "Strs", "BioRecordsProcessing", "GFF3", "ToolipsSession", "DataGraphs", "GAP", "BurrowsWheelerAligner", "TerminalUserInterfaces", "MLJClusteringInterface", "PreprocessMD", "InferenceObjects", "BibParser", "LazyAlgebra", "Bibliography", "CitationRecipes", "ChunkedCSV", "Infernal", "Logomaker", "NLopt", "CUBScout", "BlackBoxOptim", "MLJGLMInterface", "ExtendableGrids", "AbstractPPL", "StateSpaceEcon", "StaticWebPages", "DocumenterCitations", "KroneckerProductKernels", "Microbiome", "AbstractLogic", "Gaugefields", "COBREXA", "ScikitLearn", "BaytesOptim", "Bijectors", "Gtk", "DoseCalculators", "MLJLinearModels", "TwoDots", "MEstimation", "TuringCallbacks", "GtkS … *[truncated]*

### @nanosoldier — 0 reactions  
`—`  ·  [link](https://github.com/JuliaLang/julia/pull/54788#issuecomment-2194388195)

> The package evaluation job [you requested](https://github.com/JuliaLang/julia/pull/54788#issuecomment-2194167482) has completed - possible new issues were detected.
> The [**full report**](https://s3.amazonaws.com/julialang-reports/nanosoldier/pkgeval/by_hash/6282a92_vs_14956a1/report.html) is available.

### @Keno — 0 reactions  
`—`  ·  [link](https://github.com/JuliaLang/julia/pull/54788#issuecomment-2194695344)

> @nanosoldier `runtests(["ModuleInterfaceTools", "Tricks", "Syslogs", "ComputationalResources", "JACC", "OctreeBH", "MarkdownAST", "Invariants", "StrFormat", "InvariantsCore", "HolidayCalendars", "KiwiConstraintSolver", "Neighborhood", "MiniLoggers", "FASTX", "ArtGallery", "CryptographicHashFunctions", "Automa", "TypedFASTX", "MultilineStrings", "ShuffleProofs", "ToolipsSession", "MD5", "TranscodingStreams", "TerminalUserInterfaces", "MixedStructTypes", "BurrowsWheelerAligner", "BioRecordsProcessing", "CitationRecipes", "ModuleInfo", "BibParser", "CUBScout", "AbstractPPL", "OutlierDetectionTrees", "LinearFold", "GFF3", "AbstractLogic", "Bibliography", "StaticWebPages", "PAndQ", "Strs", "Gtk", "DoseCalculators", "Setfield", "QuantumAlgebra", "TwoDots", "PkgJogger", "DataGraphs", "GtkSourceWidget", "OneRule", "NonNegLeastSquaresMLJInterface", "BlackBoxOptim", "MLJClusteringInterface", "MEstimation", "MLJTSVDInterface", "DrugInteractions", "Microbiome", "KroneckerProductKernels", "PreprocessMD", "PsychomotorVigilanceTask", "MetaGraphsNext", "TwoDotsModels", "ParallelKMeans", "Rocket", "Logomaker", "OutlierDetectionNeighbors", "ProfileView", "MLJTestInterface", "BaytesOptim", "MLJDecisionTreeInterface", "SelfOrganizingMaps", "HMMER", "MLJText", "DocumenterCitations", "MLJNaiveBayesInterface", "SpikeSorting", "MultivariateMoments", "OutlierDetectionTest", "MLJSerialization", "DistributedArrays", "Infernal", "PhyloCoalSimulations", "PhyloPlots", "ChunkedCSV", "MLJXGBoostInterface", "MLJGLMInterface", "QuartetNetworkGoodnessFit", "ExtendableGrids", "HOHQMesh", "StateSpaceEcon", "ML … *[truncated]*

### @nanosoldier — 0 reactions  
`—`  ·  [link](https://github.com/JuliaLang/julia/pull/54788#issuecomment-2196310638)

> The package evaluation job [you requested](https://github.com/JuliaLang/julia/pull/54788#issuecomment-2194695344) has completed - possible new issues were detected.
> The [**full report**](https://s3.amazonaws.com/julialang-reports/nanosoldier/pkgeval/by_hash/aa4b302_vs_14956a1/report.html) is available.

### @Keno — 0 reactions  
`—`  ·  [link](https://github.com/JuliaLang/julia/pull/54788#issuecomment-2267275041)

> @nanosoldier `runtests(["Tricks", "ComputationalResources", "Syslogs", "JACC", "OctreeBH", "Neighborhood", "ToolipsSession", "Automa", "MixedStructTypes", "AbstractLogic", "TwoDots", "DoseCalculators", "GtkSourceWidget", "QuantumAlgebra", "Gtk", "PkgJogger", "TwoDotsModels", "MEstimation", "PsychomotorVigilanceTask", "DrugInteractions", "BlackBoxOptim", "Rocket", "ProfileView", "SpikeSorting", "ExtendableGrids", "MultivariateMoments", "DistributedArrays", "StateSpaceEcon", "MGVI", "SharedArrays", "GtkUtilities", "NonconvexMMA", "NLopt", "MetidaNLopt", "Gaugefields", "ScikitLearn", "LazyAlgebra", "JSON3", "RandomFeatures", "MLJTuning", "COBREXA", "BellDiagonalQudits", "TrajGWAS", "EqualitySampler", "PowerPlots", "MendelImpute", "GameTheory"])`


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
