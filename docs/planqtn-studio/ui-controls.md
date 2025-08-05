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

Sharing the canvas is possible through JSON or an encoded URL as described in
[Sharing](./share.md)

<center>
<img src="/docs/fig/user_menu.png" width="25%">
</center>

### Documentation

The documentation leads to
[https://planqtn.com/docs/](https://planqtn.com/docs/).

### Canvas menu

To find the canvas menu, hit the triple-dot button on the top left of the
canvas.

<center>
<img src="/docs/fig/canvas_menu.png" width="50%">
</center>

#### Canvas menu/Display settings

<center>
<img src="/docs/fig/canvas_menu_display_settings.png" width="50%">
</center>

#### Canvas menu/Panel settings

<center>
<img src="/docs/fig/canvas_menu_panel_settings.png" width="50%">
</center>

#### Canvas menu/Export

<center>
<img src="/docs/fig/canvas_menu_export.png" width="50%">
</center>

### Panel Toolbar

With the panel toolbar the user can control the visibility of the

-   [Building Blocks Panel](#building-blocks-panel) - building blocks (tensors
    and networks) for tensor network construction
-   [Canvases Panel](#canvases-panel) - to manage the user's canvases
-   [Details Panel](#details-panel) - to show the details of the canvas, a
    selected LEGO or a selected subnetwork
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

All calculations are done on a subnetwork of the full tensor network. These
might have one or more LEGOS, and we call them **subnets** on the UI. These
subnets are the organizing principle for the user to find calculations in the
canvas. The Subnets Panel shows the active subnets on the canvas.

In the following video we show how subnets are created and removed:

1. The user can name a subnet by either using the floating toolbar name input,
   the Details Panel or the Subnets Panel after the subnet is created
2. Subnets are automatically created when the parity check matrix is calculated
   or when weight enumerators are calculated
3. From the Subnet panel it is easy to find the subnet on the canvas, as a click
   navigates and highlights the subnet, similarly from the WEP panel and the PCM
   panel the subnet navigation can help locating a subnet
4. Subnets can become inactive when modified - this happens when an internal
   connection is added or removed or when a tensor is removed from the subnet.
   When a subnet is inactive it's not lost, all the calculations are accessible
   still from the "Old versions of tensor networks" part of the Subnet panel.
   From this state the user can also clone the tensor network as a form of
   recovery, though it will not be connected to the old part of the network.

<div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1107526611?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1&muted=1&loop=1&unmute_button=0&byline=0&portrait=0" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="highlight dangling legs of tensor network"></iframe></div><script src="https://player.vimeo.com/api/player.js"></script>

Subnets and calculations are persisted in the [sharing](share.md) URL and the
JSON files: here is, for example the
<a target="blank" href="/#state=NoIgygrgRgdgpgFwM4AIAmcC2B7EAaYUBAVnxAEZ9iAGATjwGYAmcvEABwGNMB9a-YABYAunhgQANhLYAVUqKKk2TfADZaDPEwasO3PgJFjJ0kHJAKQJMg3wAOB3nIN6e3vwJHxU2fIJXiHgAzCQBLdnY4NDJBNUE7Rho2LndDUW9TOQAxC38SYLCIqLIlOxctVWpk-Q8hdJNfHMtrNlUqWgB2PEEOwWrUz3qfMz9FMg78Dto+hg6utwNB42HzZqUQO3xaTq1aXRTFuuXM0YCC8MjotlpJwU0afZq048bcxXOiq4oPWiTBOn6hy8DRGTTy63IlDw6iY0KYqkBtWBK1OLQoKjwdm2eGIDGIiOeGV8bwCZGc+Eh1ARgkEjwGRyJIxJSAQ2CKACceAAvMmxboMTQC2ELKFExkALWZrI53LJbRxtO66kBooaEqlbMinJ5bHIExxHXxuL6IvwYpBkssLM1cG1ZM20IYCNULBVZrVFo1Mp1FBu0NUXVUdjpPFVPnVVulWtlyh+5ARtGFBzD0gj-mt3rILC2PScglcyfd4c9kZtduUGPI1CYsKY8TdLzToAz0Z92gp1GI9AY1Yb5uGlvTUdtMZAdYpzj6-xDKZeIEHzeH5bHSkhAe6xBnRdTJaHZZ4AA8s-Les6GAkFhj+6YABpe6NH5T6uwdBHEOwmg5Xj3DO+lmWPmODq0KorDEMQn76N+xa-veI6AUwfpVnY1KJoC0E7rB-4PjYHh2HWTjMOh25zn+e4ATYUIdDWThlMRjYgmRi77oBzBqDoWjkBeX4kYyTEgC28E2LYOJEUw1H0debD8YJy7kEo8QzK+fY-qYloKKAUK6HyTCWBiwp8gwekUmwSi6f4InCkoRn+PKuh+uZoD6sKfo2U5JnfPgjkbF5uoeG5ICrmw+rUJYfJVCA+oBUoEUOgFfK6PKoX+H6EXkBiAVVvgaUiQFSG6lCyWaR4ujpdllhQpoFDhZY8pVfG5W2b5FAhRVlW6g6RUUFCwrkKllgiRFTAeF1Im6NmeBdZ1FaNaADrjYNFWDcoNX+OSTjKDFbUefCs3os14l7WVG1AUdlnKP1Fn4FVPZ7RiEU6Hd11sGxk0VdlL2LWtzXyeVoisMA8lMAk+GaOQAB0sL4Qa4NuaABy1IDG2sKwVRo5NGNFej2PI7jRUo5jG042jCjE4TBNVOQwjU-4hYEMAlPU5YPH06jTMaSAADeAA6IASHAADm2BILzABcwC8yQAC05BS8QvN4LzsncjLggywrStLir8nq-gmssVLAq66IvOcNgMDwJwCChObIsgOLPMgEE7LYJgYuO-zQsAJJoGLvPkBrfOCzwoQwBgB5i9QAC+itWNg7u8572A+37IACoHnsh2HcAR-b0cx47zuuwnQfe779v+xnweh+HYtMDHkvx-bHuC8n5ei-78t66XWe13nUcF7zRdu83ietynFcUFXAu9znYsMA3ccl0nE8d9V0+z7nov58IUf4JzICYAAhgg7KhEe4sMxjKMKBTb2iKXADy7IYGfMAC-bwAH6HLJHzAnBwBDtEUWFAyCZxrjne25AC4gB-ggP+ACgH21AWwcB2cL6CCjrvSwLchZ23FpLYgMs5aB3yCEC4UQZbUBId3aWkIaGxzoUwBhhCZYMBYQJLWXJVa61jsrbhOsA7d34TLVQvD9behlh0cRnD9wCLsDIkRfUZHS2YV3PhXCpbDUUZolgOi5FaOYUIjRBjtD6MkXWcxrYtFEOMRIh8WixF2NkQBLR0jnHKwPFohRHitZeMQiooh7D1H2PgobahviDY6CsWE5gMTOReKNs4shhRLhSzViEs45DPhyw4dLMRmTpbSMKUQhRJSPhpNoDQk2IAzYWzgFbG2MB8FfyHi7EeotcFt1TlWDeECt7R0YU3TpY8y49IYH09B88B54ELu05e4927+2oJMvuotoFDIWWMye6VVlz37oPJ28zR6l26TsvZAzF6si2Wcte6du5oLWfnWZbTi4nJXks7qFyxYbMbjc1evN4TfIOS8o5byRmnIBV8h51cpn23rps95iyem0GBdvGZczwVdKhZCNFC9EUQo+T0uwaLnmYo6diz5zjHn7PWVc4ZlLU6CDRfXQ5w9-lUqYGi35S8kXbLXsDUlGLXkUtGbcyuMKZ79LrvSjlPTMk0suWy45hLkU7K5ZKzeMqCWMsnuJIVyqsVipxRMzV0r+46uNZ8usBrQXsr5eKigprY6Kp+bKh1UKmAKthU84VYLRWQqpXi91qr+X+2ZWauF6LDUBqJTs51oytXwpDbqgVqLI2+pjXKvVQrLWBtTjoW15Ls0Cu5Smq1qdvVSqjayu1KrU2ApZeW-Nk8I0up9bSheWaPXWuDXmuNdyNXturZmutRqW13NzX8ntqdhpFpFSW3mCae7mrpf2tVArqUdqVWO2NG6l1NvXWGwKwbu2hsdcu119t8XTvPVCns87-WLpAG2xNq7Bm3obZFU9u7n2vpXVGnl1yZ2T1UI++1d7PlVqTeio9jqSUZs7X6iDX7oOrqAwyitk8OjgfrVhteYHENbww8+9Nw6YO1uLSBgjh7P34f9jhojkdkN4YnbzQj5HV03t5ZBnpHG31RrJQu6jvNGOccA82gdyym1nq-WJgTayEV0bYyAMjCmkOyfoxsKdPGv01lw+OqT2mmNQMk-uscl7t3Mc0yphD4nFNmePb0kzosu2-pE6pnTwHePqp-VRnza81MAbWSRjzuKXM7z3rMw+J8z4X0IGTRLhMyZ3xxqjcmpNktZaS+jdLqXr54zegQHL2XSspay3lorSNKbkwK2lomZXGsk2K011r6Xculcq1jQrHX2sNb6yVxLmXButZK-lxmLX6vjZ66Nsrw3ZsjfqzV1L82xt1Ya4t7Lq22szc28TbbfX8tdYW1th+ntn6v1Dh-B2sDmnwP-oA0IwC05gO3fbTB0W4EIMe89jEwXIGiw+9-O732kEgKhP9jBMCvsPbBy+17I6AdA9u7-WHT3kHrEVe96HIO0fPYdJD7Hn3ceIPRyA-UhPAc49R6T578pKfI5h7T5BfoGfU-u8z8HHg2fE5pz95Bx0efA753D9aQuUcc-5+DiHWOqfYI5l0lprD6GZKUT4wOSiqmRNcfCY2sc6mW2trbMWrSn1ha3Yj4jjnHVAoiyxwz5nwv2dpUp3TWm+oGb3U5i3MHuPea-VxA1u8BAH3gUgAA1j7ZB1ZyCcFArQCJH4gjpK4mgKWR8exQEMUGI+seMB4hEhwbAEgACeMBXahCPhIZBXtRYoE5tQOl3MYDijr5zcgTeYA3jbx36BzeACaPe6VkHL+yY+YQuS2gAArF7LxXqvyDy8IBQEgCAERsDsgQFEFAQQN8oDZHAGAKBPaoBL4gMgB+YAABlBZIE-sLyXouZdvfRQ-X+CAIB35AWbTA7B+Zb+iCwRwTFSVwCGIXKWyTSSrDyVsVlhKRljUVIVsWCQ100XIDVm12sUEVQIMXjHiW1ncRwMkS4nwIES1yQK0Q4REW0UwJHG4T0VoO1EMVIK0XYUYJVksXYPoNsSIIcV13YP8UIOET8W8XwP8XINoSCSoJEJ7DEMNllgEMNiMV4NiTYKQIqUoQyXUMgMoSIXgIKQoOKQoLKW0NSUoSqS7hqQNwaSN2aRN38wDxWTtzgxNT82EwC2kxc1Cw8PRE92fR93fWt3vUs0t2s3cx8Kd3UytxcOtX40hzCIcPdwCJrSCKpSCyvWjXCID2SLWT90wxU0DztxsyMxyNpW8K-X-QyMo3cIDyHSiLdRiNnTs3qJBUSIKNozdwKLQ0E3ty90dV2Rc1d39y031SKKyPdxCJgw-U6KMxtTGLaJKMmPQ1SNnW6NHQWMdz7WUxKMqKs1aJqImI6OGJU0Qj8I8zqPiItW2PM0LXmIOJOLLUaMnjWJd16OfQuKqJWNbTcLNx8I+L2Ncy+MHTOJ8KWJ6KeIFScOdx3Q2OPTBJCyBMBVKJhPuKM3hNeIhN5heK3jc1hIvS2JmJuKhJaMyLxKhV2NCKuMJOPXk0uMBOKPMwpJg3KK0ziIyKE1+NQy83yKM2aLpNxNRPM2xIaOuJpJBK-TZIBJZJU3SIBOqM5NZKOJ5Md1pPZLeI80lMpMBMxIoE1KmPVJ8NVKlMRO+Bk3GJUyNK1KGOVOPVlK1IFIVNs25PeP+K1I5JQy0z5IyOlNmPRJRMdN5KVP8OJP5INK-TtP1J1IGOhOmQZNtMeNFP6OROs2DwIFDyPgjyjxAVoCCDgFoE4EECDClloDQFoCz0EDgBcGLIATgDllUCCHfBzOIA6CCGojIHYFn3L0wEr2rxAQb3WTwBQAYFFgSBQEEHWVhBQGIFFgIhQFUFFmUhQA6HWTQhQDsEB1xEHNoBHNUD6BQCrHWTXEHMhBHMcH3KYFcwT2POHOoiixAFH3H1CEn3ZBn1Ly7J7OQX7NYCHPWT3PHKdEHOnOxDnNc3jEHOXI-CqDXPWSxE0BQG3IYH+EnIPLuCIn3I7zxBonPPWVAj3OcFAuIDvMvxvwFi-2ADf3gQ-y-1qVdj-0QGKCAKGEwmYoYhgmkEIC5hAJN1CSYJoJUN4oUIoJQOEKiQiV5isPNkNyaRaTJM+T9OYx1LnTuIDJuITOpJt2TP2JUrhIJOOLRJDLVKwSi2-iQAAEFGkAA3OAe2U+CAOANgLfZpDfAAOUQAAHcN9w9m5TkyLv5ns0QmcpcXs2AL4HA7BwZqBqAuJphfhqAUJ1wQAS8oEXAIqoqsR8waB4r5gkAAALDfBAHgGAI+TAaykBcwNgUIJAHgNAMvYq0ITge2IIKvJAeyjgI+dkYq+i9kL-TmGONqs+BAEvHgTgHKhpcPHgY+U+c+T+JGAmAbZLbbXrPGW+DbVa7GRa2rPLGmPmbAAWeqqvHgE-T+IwEAAWI+CAAWQBI68WN-OAfmK2KIAAWVi3PgACVsA3KyKH4crQgBYcqwg-qACSKABhW2U+I+UOZAT+XeT7Z7fhMgQKuHYaMgC+PYVQVK88asRCGK34NgJK0WRMDGjoLEBPPUAUE0XK-Kwqzq5BSUCqqqmqoq7shq0WJqiQFq5Idqzqrfbq5uPq9gdq0IQa4a0azgcayauLGaxmM7Xa-aiQQ62-aGtgM6i6q6xWm6tgFq+6gA56qag8d6z6pWkAH6v6gGnKoGwWUGu7DqyGr66HOGrhBGknIKiaEAVGnoDGuwLG7YfMXGxKqBfMImkmqKjocmzWvKzfamkq2mhGhm2q5mxq5q1qgWjqkqnmnq-mwW4Wkasaial6+LK+KmGWvazgA6668i5W86y6hW0io2rWmwp6-Og2r6tgE2-63682qIEGsGm2mAKGm6+25BTxJ2kXMnNObnUKusT272nG-Ef29ZZgIO7YEOsOgSCOgqpm0qkAO8em6q+O+qxO9m5OrmtO20DOzmgaoanOsWvOvWmatmYuuWmulu06qutW2ujWgSO6hutAXWuLZuo2tus2i2gWK2lkXu-u8irBNgawxpW2e-f1byj5ZBQvWXQZOOJBxZZBZG1BF-MlRBzpQNFBhHTeUzBy3AQh5BkBV2tBjFAhg+Kh4KynfFDByhrBkBW6XBy3A5N-X6oqj-dkLexXbilxaxPikSixQSyQw2aQ0SvXU2SSmw6S+wwUnS5wxMz1AygE901jNEtSvS8zFgcUrTeS69E0h9Io4PPqpACy67EAAAHhsYFgAD5BHs52QUASr7GAB6Jx5xkfGmkBaUFAM+QG2Oq-bAMW4oVmpO1BDMhAAAVXYDQBPmibHGrCITiqlk7BkD6lc3HLoHBkEGBklGgdAGEc-mV1keIIwP4u1h4IkYcSSXEv10UbgbsPv1Uf6OdI83uRjK0o9PaMGJNPkmMaGf6e1I0apSZMCKMv3lgTMsstKtstascqQBcvcs8swbwQQbHoCudtFxRvthoFoFSuioyritUASvxuYAhkivOdiqyvDqps3uQXKoWb3qZoPpiaPovu5rPr5ovqFqvtFvFvzvvtxnmvWsmwq0haqyOzmxhfKy2sftLvlvLpOpVurvLtuu1sbr1oAc-qAY7pAbAfBttuhsHpAXhoqoObHvQKOcBwFGnprB9u2DnpucXsitmGDrJsQuecjteZATpo+cZrqpZrZo5v6v+d5s6UzsvpFtzolumsvmltQVlrRefqNqxffpfvroet-qbo+pfuJcBq7stp7ohr7rtthqHr8RHsfzHoFEZdxCYBZext9o5fhWoiXtJtDv5bXpecCe3tjs+fFcPqlZTplfPv6uBcVZvuVYLofvVZLrLvVortftVq1c-v1Z1qNcNqJY7uAfNdActYpYHttepcdtpdHue1+hCvew-HdbZb9pudfF9ZXoDcpsFeDZFcqrDYTp+cjZPq6pjZTrjevrBbvtVacG2okA1bTY-ozZ1ezYzdzfxf-uNcAaLZJZLbJYgbtoflgdsN8voaIfBxIf6TMfIe2bbgFz5Ep3weHlvazJQUfb6tZBfee2da4dIdJLPcYef24ZnI-YoYYfYYoExzwYHl4YFn4YgEEc-K4sqbALgLqYEVqcaboJlgaZMVcWadyAUfqXaZkq6ZxR6dBNMdJLI6DWGajOFIGd0c2JczyP8JmZ6LmesdseQUcdsecfsc4FCHZE4H5hQE4APAAF4AByKsagKTsTkvaT2T+T9kJTyK+ToIUIKQaTwRtAKT7x-jrfA8ZfSTmT9TlARTszuTnfLTiQaTtyn6rfKT5xgACTuvnZQDXxSYAJQGGi9WyYURybycQonPBgTyYHFB8aM4QH498b44CejqCbZGPzgCCGXzNnZHgHZHCcifD2icldaokHiaSe87Sb88ycC+IFyYQvHPSjC+rFKeAJ8pEboTQ6w6YJIK4JlgkLw74KcRaaI6kuN06e0qTP0ZtJtz1NmfNJKM0pA6jIjOm9kp6Tm9Y7Cy9O0Zg+MoWfMutispsvZDsocsP3WfZFcoQA8vZC8rYZ2Zuz2fWERvpYhwvhhDOfSseaufmHxpdHRvufe8ys+4FY3uDfef7bFcHYK7+dPtld6qBeztBdvslsvjmrWoWqRc2uWoIARaG3R6m2vjnYXfRfTcxbftXdxZ-r-req3cLdNt3bQG7utqtcgZhr8rtbkQddB3pYJxe6dGbdnrxvthdDueoB5eXr5YpvXqjq3r7bjq+Yldieleh7HazpBaVfBZnaLpTafpxcrqzZ16-rxcNYJep4zdNc7vp4tcZ-LagcrdEboI57xwF1Zxe4DD589YF9FiDGF9F79dXu7eB8S-nFDfB++ch8V9HcBdjfh7V+nYS1ndRcXZfpXf1-XaN83YLdN53bNYt9Lat+tcpdt+Hprcdd+3pwvlPDd-ZY99UHPA7fF6B6l+QR3tFf3vl9+fD-Tsj-Hej4TfV8IGTZ2tTaJ6XYfmT-TfJ4Ncp-1pN++qz-N4Z-AaZ8PZgbaZPYQefZu7vel0vfQWvdYfA7LgFwJ1oZgQ34P63+6h3-DmTRvc39fb6iv4ByffaS-YFyA7-Y2X3-PbHHpxP9g-g8Q59lkOBCVDm1167YdOu6HbrnIX4IDcaKxHE9io1G44o5uPpQxlNw44zdHcc3a0v4UW6YDluOyVbiMw25uktuIALjnY144uMBOQnETnADE6mdlOCnNTtZ1U5WcNOtnHTlEH06Gcc4JnVgfJ0s7MDNO2nKTg5yFpwBnObnKQNgE87JNUmaAXzhkwC7ZMquwXccvCHBgdB0CkXbxtF1i5+MEuW9SECgAAA+KAOQMeTsDmCUA4oY8rQFsH2DfOqgWwc30qoRMomwCMPkVxZAldFB2DFQVkyC41cZy6NHQYIEa7+AKmIAuhDAQ0Jp5oC8BFXBQXSgwE2E1TLAph3AEddcOPFbWP13a4EEWCkAooWQUCSUFVcuiMSmUK0RSMchHBZQrULMRddOCUA-zooVgFFDBCMA9XN0K0Q9dWEwlBoYkhqEjD5CchOJIoQI6MJAgOhNPFoUkIJDck+hdIUYWkYmElh8w4stUlaYIDlGI3QZiUS0ZkCoyVHB0kcMdwnDmSIzV0vqTjLdN1G6lYImM1m7jd3iGA9YjRxW5Bkws+Ar4cgKpTECoypA+4VgKczvCPM7HBzA8JxR3DliilUEUt2+HnI6OUzeVK8MdzwiUiilS0mCMIFrxnAFHPTNCNpQ6MHcTmKjmgOPRepMREIljiM1JH+lLhlI34X8X+FkiwyIxYkSYzm7ki+inqSET4QY4gdYRvaNEc8M+RMjYy4Im3LpQm73psRAIlkfiSeEGMaR1w5EYCILRCi9MfIrkSpio64CPMIoi4UxzUYTM1uoJTUQQJRFrxpRVJdUY6jxFcYDRRmB0WunRGgY6RjqEUdMSdFQokRUaM0RSN9G6itMLo20dqO9FeETSHIrePKRVFQpPhGJL0YSMjHKjzRjqFMTiRGY5iEido0TOGIKI2iYRsoqFBmNTGSjU48YmUQSN5hBjfUilJUZyLFGpxGxZRE0toB9GBi2RjhH4kmM+S1jHRCozlAOKzFQphxno6sUQKDzbdKqu3UIPt1FgrNjuTlM7psyu63tT293B3pzjfYXwTmb3GKgD2ubXoWAx4i5k80DY9tA+oPWXuGyHbH1U6EfOVnD1V699Y+s1XbGjyvjItMe34jrDjz-GdZ+sBPIfquxJ569x+mtb+pP3zYms5+pLMtvnwras8gmD3Olr9kZbqAGAl4j7meJnI6B8Jp47KpLyFZMhd6IfNvsOxfGd83xUfD8VOyR7984WOWDastgAnY8tsuPDHmq0H7a9ieo-Uninzgl5tjeGfWfrT2z4L9yWqEm3uhNJDF9Oe37RlmFRImXNCJzgU5n9xPGaSyJQbO8Q9wfEQ8FeUbJXl3xV7xtmJKrViSj3Ym8TOJFMFaodkRYgT-x-E+dhBIxbCToJI-WCYbyn6EtM+0k+fpb0X7W8WesCfynMLMJfBHuz2B9i93iCV9W216GgHX39YS9DJW9bIMH1b4Rtnx0bSyQq0naI9bJ346bNC3ckY9nJWPValCyqxrYUWWvTVj5N17YsYJBvCnghO3ahTkJefZnlSyyRxS9xQVdYKFRSrcsvarLfnvPXhDUBMpfvciSD2IA5AqJBUp8VD1fGw9GJ1k8qUmzYluSksKPNmPVNcnATmp+PBPsPzIpQTOp-k7qfBIkmIT+pe7FCUNNt77Na2yCMvsc06AaTrx+NHoIIEBmA8bxAfXKcZIHah8zJI7eibtO75MSDpELeycdNAn2SXJtWS6Y1jvia8BJbUoSR1N1Z10xJG7KnpJNbpIT3pg0m1opO+kl9kEFOcvtMDBmETZgHQNmQZNvFQz8pcvQqdtIRnysJ2CPRNqjJ-HVSTpbErGUBJ4k1S8enkwnpBN8kPS9WZMtPhTNent0ZJ4UuSZ9PpmYSfpICbnvbG2CczdJV48GfjUQjC8HmpEhvhRPvEwyaJRUiyQxKRn7SxZyPI6TjP-F1TAJ62fbI5IKwtSCZifY6irJJk5t1ZQUmflTLek5992S-AvgbISFjS4czve2L0DwnTSZ67veeg8CWldsVpRk9aS335lbSO+ALd2VZLKley7JEszGBxLhZnSA5NWX2RjOumtTw54se6VHLXYxzepNPbWWFNz4RT5JUU+7mnOUmO8ucjLWKqlK9aA5Cm3LYmmLyykOzVpZcsHptLD7mSdpwsnvjZMOloyO5ePf2dxKDnyy+J8fbubdIjnEyyeAUnqS9L6kjyBp48-WdFOQQMyVJb-HCYTQtkESvugvLQUAvtkQzG+ZVaGdRIFlVyYeh85GfXMqmo9JZnci+Q1PRlSzQ5XkwSUuz7lPynp4k9PlrOLaJyPpdM7+RhPTn0s-soVbYFzI964hiAjCyBY7JgW7y4ZdE6uYjNrmiy++KCxqc1mvlOSiYMswOb+KumKzvJRMzNqrNJmBSh5IU9+TTM-mULdxM8-cWLgviUhfuaVPSUDPey0hWF-vKBZRPLmPi958MnhYgs9kCLTpTWZuQ4vxiYKz5sLHBUrPalyL+5E-YhZrLflkLZJB7FOVQrt7LgEp97RlqhUXke8hQRc7KTzJjobSK5Vi7hQgvfF2Kvx0ivBUnxEldTU+scymcbWpnkLaZISsejSwlx-zwcf00WBBG94zSPWVfeeoWR0ki815vvYuTlKSUWLTJ7ffeULIyV1yBF2SwmY9LH6PSClSiqSSotKVqLylDtdnpoqCp6gXWhoGJQXMQrxLN5gfGXs7LgUDKbFQy-hVktvlhz75n9CZWrMUWvzh5gS3WcErQmhLKlES8HCbM9689c5s0-Od9wvGrzeWG8thb2z5mWKuFxUmuaVJOUsTC64EnJdqzyWTLB5ty5RfcrHl6z1FiyzMMstFyZzPervL5U0rSme9gw2yoFbspBV9LaJ4K3hZCpj7QrRlPc5dgiuuUvySFASunkEuTlPKKl1bKpbPPSbzz4wGy-GoAvaUArlp3S4VhSthn9LrF6SvacMtOX4zcFYy3JX5JZXPS2VdyjlQ8q5UKTnlvK15WOGe6myPaBKltkvPQJtKfenbBJZDJ6U7yUlYKt2TSpFl0qKpDKi5UyvVUKLWV-i7VTrLRWPL9VPKpZXyv3E1hGWVYGsMKvhQpT-l68iVYkqlXJLQVsqtJcr1pWfj6VZylVYysjmEKplyKmZaiqTmRThpLyrCdg0Lw6LOw1qxpRatiXVhSVpiiiXstgWVzDl8qj2YqpzXKrPFXUq5b6s1X+qUVOqoNXqsnmYrWwNC37ElKgSThY1y873h0ttU7Lpe0ql2YLKOUKqoVHq3NQOvGXMrh1fi6fkUrN4fz0VCytnlivDUu0JpC6-FSLwbVzTgZm4FtSXI3WprKVrsg+ccvdUF1PVhCoddHJuVaqx1gastRPIrX2tsVY9XaA2wXKFkl1NfcKgms6V2qzF7gkyTKqpUurbFvaiqQPzzVeqC1oksDaOpLXjqoNX80NRRDg2-ZmZ9sF8HosxrfLml+Nd8KDPQ1rqyVW9bDfss7VyrM1bq7NURvvh3zgNx60DX6rPWkLqNFC69VWxYizrsG7ykCA0rzkcbjmEED9ZKpDbfrcNv6wZbuoA0QtQoN0qTT6pk0jq5N7KyDYpu5XTqhIDG7BriuQisaX1Py97KKptX18+NTfTdQcuE0lTRNx88zbCtVXwrrNA8ijXZoDWjyaNGKm9ThFc0cMJ6zGqeuatfXJU3WPG-za2uDYCaO1qS6lQRr3WHSLNkm-XiBti2ybgpVGhzWUqc0paXNd6uHI9EQ3UQ8tz6rTUSq4g5yxViarpcmoM29KjN267tXwrM3eyqt5yqzfIps2nqGt8c2ZZyvLWF9YN7Wp1nQsF7ETst3mmclxD02jbitnC9NWVv-VibKtkW-NY-PI31a45xShOetug2baVNaWtODWuOZctet7GoleJB61+bAVhWwPmdqdUXb8NV28LbNtu2kb7t+SpFeBsa2JbHNIa5zeEqrXg4H1gOJtgdu02uZ22+WkHZ+odU4at18CkTUfJRka84dC2nxc-Ns0rbnta23VeWqPar9pK6-F-nfzraP8dFoHV-iAgfay5KMAHCDn9lF2C7edyCEXS-lxLi7D+1DfnWQy-6MMoOwHMXWf2-6oMX8CKNXRBw11-sFd2uxhr-xfyf9P2Mu7MirtFHRZTdEHCnFLtv7n9X2rOWXCbp52u7nsTui3dLu90C5ucUu0-l7u-7H89d-u7-llF-ZXt6S9u0Pertt2W6wO3-X3cB2f6uwhd8OGPbv1gwG6ldkUW3Z7sz3W7Aotu9BlboD3Gyi9dDB3QXrl3Adk9We83entr0J6IO7u6Di7qj2S75dbekvVXs8g57r+eeyvVHt13Adi9mALPZ3sb2R7AO7-WPRnun2l7o9lOJvavt72t6Q9A+qPTXu72AcG9f7Zfc3v3356L+DUYfU-370r7B9Lev9vrrH2Ac09x+m-VnshBn6n9EHLiOXrf2r7F9uex-SnsA6z7X9O+2-Trt-0H6JdQe6DuAaz0T6P+8+iXQAZH0n7S94e1vdAYL2Rqr9F8dA4PswNIHsDF-dsHgdaKK6L9iBpfcgZwNH6aD8B1fdQdz0b7B9XqX-YwcH0f7yDa6c-a+wQ3vtODPe23UAaz2HQeDBB4QzwdYPf9gYHB+PbvsA7MGR9oh0vYhHkMHw69F-ZQwDhYZf6C9nDQQwoYgOMMt9r+kg6+061GHND7enA5-uAMQdXo1hyg-fygN8Hv2Oh-A3-q4MiHaDF+o3Qwf-4nwEOQjYARLFQ7xDthSQ1IWAOVyIFpGzgTIRAOyH5CBEeQsJQUJKFCEGh8iEoYMLALxGcjWiMYakbqEsEaw5RtQs0JSMZHuCMAwoeMPEi9CYB+R6WMMPyGjDJh9Qjo0oUmFVHZhywxYQMe2F6EKCBhaRusNmFSxNhwxuKTsMsJ7ChuHTB2IWNNJqjRx4yccaGJxSljOxUZFscyInG0cJm-ojY5PD6Ykl+R-hVAV2PzGMdtjQIvse7inFXHzc8o-wh2MOMPGekxY90WaXrG+FYxiInsccZJLGiIifot0ViKeMnFKxXxgUVSio6nH3iHo14xESpFdjITbY1EZaMZEgnNjEogMdaheNQmaRPIw0fqOxOlogTaYrEv8dWMHHtUtJl9FsYROzp3jvTRk-cbZPnHyTsxXY-CefQYnFKlJ8sXJRhNGZTRpJ1UbiZ1IWMTj0p8knyfMxwm6xqxj0dSOzH4nniyp49J8bVPRi14IozUxWO1M0YaTM4wLPScNPsYJTKpM07aYZFRk7j1HG09+gtNEmekApmVFSaLGEmzjVphkb6eMwKnmxDpkMySRNPWokTipz5PqZv7MnnMuJ4MySf2OsnSMvx7AXOIoGa1uOICagfx0E7CdRO4nQQSwI4EhMyzoguzlJ1068D7G0XFAEwPM7CDzO1Z+zo5ykGud3OcgrzooOUH+dgh6g0IVsshDEA9BBgnxkYLYAUSEAo1HfCYBQDwALuWzemp4Ly7eCFevgxJgoIAKBDBzlXarvk3ybgwxzjXamEAA">3x3
rotated surface code canvas with the subnets from the video</a>.

## Floating Toolbar

The Floating Toolbar provides quick access to various operations and
transformations that can be performed on tensor networks. It appears as a
floating panel that can be positioned anywhere on the canvas and contains
several sections for different types of operations.

### Subnet controls

The subnet controls section allows you to manage and manipulate subnets within
your tensor network.

Legos can be collapsed into a single LEGO with the parity check matrix being the
same as the subnets. Uncollapsing is not yet supported, track
[Github issue #147](https://github.com/planqtn/planqtn/issues/147) for that.

<center>
<img src="/docs/fig/floating_subnet_01.png" width="50%">
</center>

If the subnet is named / cached it can be removed from the cache with this
button:

<center>
<img src="/docs/fig/floating_subnet_02.png" width="50%">
</center>

If the subnet has highlights, this will remove all highlights within that
subnet.

<center>
<img src="/docs/fig/floating_subnet_03.png" width="50%">
</center>

### Calculations

The calculations section provides tools for calculating the weight enumerators
and the parity check matrix for subnets.

<center>
<img src="/docs/fig/floating_calcs_01.png" width="50%">
</center>

<center>
<img src="/docs/fig/floating_cals_02.png" width="50%">
</center>

### ZX transformations

The ZX transformations section offers tools for working with ZX-calculus
diagrams and performing ZX-based operations on your tensor networks. These only
apply to X and Z repetition code LEGOs. We highly recommend
[John van de Wetering's ZX-calculus for the working quantum computer scientist](https://arxiv.org/abs/2012.13966)
as a literature for the transformations here.

#### Change color

Apply a hadamard on all the legs:

<center>
<img src="/docs/fig/floating_zx_01.png" width="50%">
</center>

<center>
<img src="/docs/fig/floating_zx_01_2.png" width="50%">
</center>

#### Pull out a leg of the same color

A special case of spider unfusion, pulling out an extra leg with the right
colored stopper LEGO traced with it:

<center>
<img src="/docs/fig/floating_zx_02.png" width="50%">
</center>

<center>
<img src="/docs/fig/floating_zx_02_2.png" width="50%">
</center>

#### Bialgebra and inverse bialgebra

These rules can commute through neighboring Z and X spiders in exchange for an
increased number of spiders and vice versa.

<center>
<img src="/docs/fig/floating_zx_03_1.png" width="50%">
</center>

<center>
<img src="/docs/fig/floating_zx_03_2.png" width="50%">
</center>

<center>
<img src="/docs/fig/floating_zx_04_01.png" width="50%">
</center>

#### Hopf rule

If an X and Z spider has more than two connections between them, the Hopf rule
can remove two of those connections at a time.

<center>
<img src="/docs/fig/floating_zx_05_1.png" width="50%">
</center>

<center>
<img src="/docs/fig/floating_zx_05_2.png" width="50%">
</center>

#### Unfuse to legs

Another special case of spider unfusion: one spider per leg is created of the
same color.

<center>
<img src="/docs/fig/floating_zx_06_1.png" width="50%">
</center>

<center>
<img src="/docs/fig/floating_zx_06_2.png" width="50%">
</center>

#### Unfuse to 2 LEGOs

This allows a more surgical unfusion: the user can specify between two LEGOs
which leg will stay with which LEGO.

<center>
<img src="/docs/fig/floating_zx_07_1.png" width="50%">
</center>

<center>
<img src="/docs/fig/floating_zx_07_2.png" width="50%">
</center>

<center>
<img src="/docs/fig/floating_zx_07_3.png" width="50%">
</center>

### Graph state transformations

The graph state transformations section provides tools for manipulating graph
states and performing graph-based operations on your tensor networks. Graph
states are defined as graphs with "X-type" nodes connected by edges with a
Hadamard on them. Thus, the user can start from X stoppers (|+> states) or
Z-repetition codes. All these transformations preserve the number of dangling
legs on the tensors.

#### Complete graph through Hadamards

Creates a complete graph through Hadamards. Can be used to just connect two
vertices.

<center>
<img src="/docs/fig/floating_graph_01_1.png" width="50%">
</center>

<center>
<img src="/docs/fig/floating_graph_01_2.png" width="50%">
</center>

#### Connect via central LEGO

Adds a central LEGO and connects the selected X-type nodes to this central LEGO.

<center>
<img src="/docs/fig/floating_graph_02_1.png" width="50%">
</center>

<center>
<img src="/docs/fig/floating_graph_02_2.png" width="50%">
</center>
