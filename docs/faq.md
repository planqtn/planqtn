# Frequently anticipated/asked questions

## What do we need authentication for?

The only features that need authentication are:

-   calculating weight enumerators
-   calling into the network API when constructing tensor networks

In the future though, we will introduce:

-   canvas backup
-   public entry for our code database
-   other backend calculations, e.g. qdistrnd distance calculation tasks

However, even for calculating weight enumerators you can just export your canvas
as Python code and run it on your own computer.
