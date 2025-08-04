# UI Controls

## Canvas controls

The tensors are on an infinite canvas that allows users to zoom with Ctrl +
mousewheel and drag (with Alt + drag). The collapsible minimap shows the content
in gray box with a red rectangle showing the currently selected part of the
tensornetwork.

<div style="padding:75% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1106954448?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479&autoplay=1&loop=1&unmute_button=0&byline=0&portrait=0&share=0" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="canvas_zoom_video"></iframe></div><script src="https://player.vimeo.com/api/player.js"></script>

## Canvas menu

To find the canvas menu, hit the triple-dot button on the top left of the
canvas.

<center>
<img src="/docs/fig/canvas_menu.png" width="50%">
</center>

### Canvas menu - Display settings

<center>
<img src="/docs/fig/canvas_menu_display_settings.png" width="50%">
</center>

### Canvas menu - Panel settings

<center>
<img src="/docs/fig/canvas_menu_panel_settings.png" width="50%">
</center>

### Canvas menu - Export

<center>
<img src="/docs/fig/canvas_menu_export.png" width="50%">
</center>

## Panel Toolbar

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

## Building Blocks Panel

PlanqTN supports two types of building blocks, tensors and networks. They can be
accessed through the Building Blocks Panel accordion, Tensors on the top and
Networks on the bottom.

Tensors can be dragged from the Building Blocks Panel, to the canvas. See more
details on the supported legos in [Build tensor networks](./build.md).

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

!!! warning

    Under construction [TODO: finish]

## Subnets Panel

!!! warning

    Under construction [TODO: finish]

## Floating Toolbar

!!! warning

    Under construction [TODO: finish]
