# UI Controls

## The Canvas

The canvas is an infinitely large space, that allows users to construct tensor
networks freely. It was designed to hold multiple tensor networks so that users
can create, clone, modify, analyze and compare multiple constructions on the
same workspace. On the top right the users will see the
[User menu](#the-user-menu), link to the [Documentation](#documentation) and
[Share the canvas](#sharing-the-canvas) buttons. The [Canvas menu](#canvas-menu)
and the [Panel toolbar](#panel-toolbar) are on the top left corner and the
canvas minimap is on the bottom right corner to facilitate
[Navigating the canvas](#navigating-the-canvas).

### Navigating the canvas

The canvas can grow large, and so navigation is facilitated by **zoom** - using
Ctrl + mouse wheel and **panning** with Alt + mousedrag. The collapsible minimap
shows the content in a gray rectangle, with a red rectangle showing the
currently selected part of the content.

<div style="padding:75% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1106954448?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1&loop=1&unmute_button=0&byline=0&portrait=0&share=0" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="canvas_zoom_video"></iframe></div><script src="https://player.vimeo.com/api/player.js"></script>

### The user menu

<center>
<img src="/docs/fig/user_menu.png" width="25%">
</center>

The user menu allows for signing up and signing in via Github and Google
accounts, and signing out. See [FAQ](../faq.md) for what features require
authentication. Only the email address of the user is stored, no other
information is used from the accounts.

This menu also allows to investigate the monthly quota left for the user. See
[Cloud Runtimes](./runtimes.md/#free-planqtn-cloud-runtime) to understand how
quotas work.

### Sharing the canvas

### Documentation

### Canvas menu

To find the canvas menu, hit the triple-dot button on the top left of the
canvas.

<center>
<img src="/docs/fig/canvas_menu.png" width="50%">
</center>

#### Canvas menu - Display settings

<center>
<img src="/docs/fig/canvas_menu_display_settings.png" width="50%">
</center>

#### Canvas menu - Panel settings

<center>
<img src="/docs/fig/canvas_menu_panel_settings.png" width="50%">
</center>

#### Canvas menu - Export

<center>
<img src="/docs/fig/canvas_menu_export.png" width="50%">
</center>

### Panel Toolbar

With the panel toolbar the user can control the visibility of the

-   [Building Blocks Panel](#building-blocks-panel) - building blocks (tensors
    and networks) for tensor network construction
-   [Canvases Panel](#canvases-panel) - to manage the user's canvases
-   [Details Panel](#details-panel) - to show the details of the canvas, a
    selected lego or a selected subnetwork
-   [Subnets Panel](#subnets-panel) - to manage cached sub networks and related
    calculations
-   [Floating toolbar](#floating-toolbar) - for selected subnetworks

<center>
<img src="/docs/fig/panel_toolbar.png" width="50%">
</center>

### Hotkeys

| Hotkey             | Action                                                                 | Category              |
| ------------------ | ---------------------------------------------------------------------- | --------------------- |
| f                  | fuse LEGO                                                              | subnet transformation |
| p                  | pull out same colored leg                                              | ZX transformation     |
| Ctrl+A / Cmd+A     | select all LEGOs on canvas                                             | Canvas controls       |
| Ctrl+C / Cmd+C     | copy selected LEGOs and their internal connections                     | Canvas controls       |
| Ctrl+V / Cmd+V     | paste copied LEGOs and their internal connections at the mouse pointer | Canvas controls       |
| Delete / Backspace | delete selected LEGOs and their internal and external connections      | Canvas controls       |

## Building Blocks Panel

PlanqTN supports two types of building blocks, tensors and networks. They can be
accessed through the Building Blocks Panel accordion, Tensors on the top and
Networks on the bottom.

Tensors can be dragged from the Building Blocks Panel, to the canvas. See more
details on the supported LEGOs in [Build tensor networks](./build.md).

<center>
<img src="/docs/fig/building_blocks_tensors.png" width="50%">
</center>

Networks on the other hand are just simple buttons, and the generated network
will be placed around the origin of the canvas. See more details on the
supported parametrized tensor networks in [Build tensor networks](./build.md).

<center>
<img src="/docs/fig/building_blocks_networks.png" width="50%">
</center>

## Canvases Panel

The Canvases Panel let's you maintain the canvases in the local storage of your
browser. All the data you have is stored locally as of the first version of
PlanqTN.

<center>
<img src="/docs/fig/canvases_panel.png" width="50%">
</center>

You can delete a canvas by hitting the trash can icon, or by selecting multiple
ones and hitting the _Delete All_ button. You can create a new canvas by
clicking the New Canvas button. The Canvases panel can be activated from the
[Canvas Menu](#canvas-menu) or using the [Panel Toolbar](#panel-toolbar).

<center>
<img src="/docs/fig/canvases_panel_selected.png" width="50%">
</center>

## Details Panel

The Details Panel gives an overview of the canvas, the selected LEGO or the
selected subnetwork.

For the canvas it shows the number of LEGOs.

<center>
<img src="/docs/fig/details-panel_canvas.png" width="70%">
</center>

For LEGOs and subnetworks it has 4 sections:

1. **The toolbar**, with actions enabled specific to the selection. This is the
   same as the [Floating toolbar](#floating-toolbar) next the selections when
   it's enabled.
2. **The Info panel**, with some details about the LEGO/subnetwork, allowing for
   renaming the LEGO/subnetwork.
3. The collapsible **Parity Check Matrix section** - for LEGOs, this has the
   default parity check matrix. For a subnet the parity check matrix calculation
   has to be requested and stored. This action caches the subnet and names it by
   default by the number of LEGOs (of course the name can be changed
   afterwards). The
   [Parity Check Matrix widget](#the-parity-check-matrix-widget) is interactive,
   and allows for highlighting connections / dangling legs and reconfiguring the
   generators.
4. The collapsible **Weight enumerator calculations section** - when
   [calculating weight enumerators](./analyze.md#weight-enumerator-polynomial-calculations),
   new tasks and their results appear here. They can be deleted and collapsed.

<center>
<img src="/docs/fig/details-panel-lego.png" width="70%">
</center>

### The Parity Check Matrix widget

The Parity Check Matrix widget is an interactive tool to explore the Pauli
stabilizers of a stabilizer state or subspace. It shows when the given
stabilizer generators are CSS or non-CSS. It provides its own menu for
interactions and allows for certain sorting the generators, combining the
generators, selecting them for highlights in the tensor network and navigating
to the columns corresponding to the LEGOs with the given legs.

In these example video snippets we'll walk you through these.

1. In this video we show the parity check matrix of a LEGO on the details panel
   and then calculate the parity check matrix for a subnet, and name it My
   network. Then we show how clicking with Alt + Click can give a temporary
   highlight and navigation to the corresponding LEGO:
      <div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1107465592?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1&loop=1&unmute_button=0&byline=0&portrait=0" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="Parity Check Matrix for LEGOs and a subnet + navigation"></iframe></div><script src="https://player.vimeo.com/api/player.js"></script>
2. Then, using the menu of the PCM widget, we'll CSS sort the generators, and
   then we sort them by stabilizer weight. Dragging the rows, we recombine the
   generators, while the weight label gets automatically updated. Finally, we
   reset the by hitting "Recalculate".
      <div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1107473285?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1&muted=1&loop=1&unmute_button=0&byline=0&portrait=0" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="pcm_02_menu_sort_reset"></iframe></div><script src="https://player.vimeo.com/api/player.js"></script>
3. We create a subspace tensor network with the identity stopper and copy the
   PCM as a numpy array as well as a
   [QDistRnd](https://github.com/QEC-pages/QDistRnd) instruction for distance
   calculation.<div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1107481001?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1&muted=1&loop=1&unmute_button=0&byline=0&portrait=0" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="pcm_03_menu_np_and_gap"></iframe></div><script src="https://player.vimeo.com/api/player.js"></script>
4. Highlighting the tensor network is possible through LEGO-level row selections

    1. by single click on a row - selects/unselects a single row
    2. Ctrl+Click / Cmd + Click on a row adds/removes the row to/from the
       selection
    3. Clearing the selection is also possible by using the Clear highlights
       button on the toolbar from the Details Panel
        <div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1107484255?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1&muted=1&loop=1&unmute_button=0&byline=0&portrait=0" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="highlight LEGO legs"></iframe></div><script src="https://player.vimeo.com/api/player.js"></script>

5. Highlight the tensor network using tensor network level stabilizer generator
   is possible for the dangling legs as of now, internal legs have to be
   manually highlighted currently, track
   [Github issue #129](https://github.com/planqtn/planqtn/issues/129) for
   updates on automated internal leg highlights.
      <div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1107487481?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1&muted=1&loop=1&unmute_button=0&byline=0&portrait=0" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="highlight dangling legs of tensor network"></iframe></div><script src="https://player.vimeo.com/api/player.js"></script>

## Subnets Panel

Calculations are

## Floating Toolbar

!!! warning

    Under construction [TODO: finish]
