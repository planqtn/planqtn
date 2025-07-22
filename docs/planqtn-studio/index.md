# PlanqTN Studio

## Getting started with PlanqTN Studio

The idea with PlanqTN Tensor Studio is that you can start to explore the
framework via small examples, including calculating weight enumerators and
distance for small networks.

As a demo, let's create the
[Steane code](https://errorcorrectionzoo.org/c/steane) out of two `[[6,0,3]]`
tensors!

<ol start=1>
    <li> Navigate to <a href="https://planqtn.com">planqtn.com</a>. No need to register, unless
    you want to calculate weight enumerators, which we won't need for this
    tutorial!
    </li>
    <li> Grab two pieces of the <code>[[6,0,3]]</code> tensors on to the canvas
    <div style="padding:51.42% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1103159520?title=0&amp;byline=0&amp;portrait=0&amp;badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479&autoplay=1&loop=1" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="drag_603s"></iframe></div><script src="https://player.vimeo.com/api/player.js"></script>
    </li>
    <li> Connect the two logicals legs and calculate the parity check matrix - we can
    already see that this is the <code>[[8,0,4]]</code> encoding tensor of the Steane code.
    <div style="padding:50% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1103159534?title=0&amp;byline=0&amp;portrait=0&amp;badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479&autoplay=1&loop=1" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="steane_tutorial_connect_logicals"></iframe></div><script src="https://player.vimeo.com/api/player.js"></script>
    </li>
    <li> Add in an "identity stopper" to any of the legs to get the subspace parity
    check matrix
    <div style="padding:50.59% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1103159489?title=0&amp;byline=0&amp;portrait=0&amp;badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479&autoplay=1&loop=1" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="steane_tutorial_identity_stopper"></iframe></div><script src="https://player.vimeo.com/api/player.js"></script>
    </li>
</ol>

Well done, now you've used the quantum LEGO framework, created a topological
code via a generalized concatenation procedure!
