# Stirling-Tools/Stirling-PDF #2433 — Feature: Support manual redaction

**[View PR on GitHub](https://github.com/Stirling-Tools/Stirling-PDF/pull/2433)**

| | |
|---|---|
| **Author** | @omar-ahmed42 |
| **Status** | ✅ merged |
| **Opened** | 2024-12-11 |
| **Repo importance** | ★80,250 · 7,030 forks · score 113,369 |
| **Diff** | +7549 / −9 across 14 files |
| **Engagement** | 74 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @reecebrowne — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/Stirling-Tools/Stirling-PDF/pull/2433#issuecomment-2539171637)

> Hi, this feature is absolutely fantastic, great work! I just have questions about presentation. 
> Is there a practical reason you used the pdfjs-legacy pdf viewer instead of using the implementation used on pages like sign? As it is this feature presents totally differently to our other editing tools and may be a bit difficult to use, especially with how small the icons are for the redaction tools.
>  If you could look in to making it look more like the Sign feature or explaining the potential issues if there are technical reasons for doing it the way you have that would be hugely appreciated. Thanks!

### @omar-ahmed42 — 1 reactions  
`👍 1`  ·  [link](https://github.com/Stirling-Tools/Stirling-PDF/pull/2433#issuecomment-2539750290)

> Hi, before I explain anything let's take a look at what we need first to implement this feature (redaction):
> 1. To be able to select text.
> 2. To be able to draw shapes (mainly rectangles).
> 3. Zooming is required as some text might be really small (because of font size) or because accuracy is required maybe to redact an area of the page (such as parts of an image).
> 
> Let's address each point, as for :
> > 1. To be able to select text.
> If we used the implementation provided in sign page for example, we will run into the problem of not being to select text as the provided view is simply a canvas without any text (if you right click on it, you can store it as an image) so basically it's treated as an image, which would be fail in our use case, we will need to add extra logic and complexity just to display text in the canvas which might prove error-prone, on the other hand, viewer.mjs (used by pdf-js for the viewing pdfs) actually provides the canvas as well as the text on it placed where text is supposed to be placed (in short, canvas with pdf's text). so by using viewer.mjs in this case, we've what we needed ready for us along with a toolbar that we can use to add more tools or hide existing tools.
> 
> as for:
> > 2. To be able to draw shapes (mainly rectangles).
> 
> This might not be a problem for either, the sign implementation nor the viewer.mjs
> 
> as for zooming:
> > 3. Zooming is required as some text might be really small (because of font size) or because accuracy is required maybe to redact an area of the page (such as parts of an image).
> 
> We will still have to modify the code and ens … *[truncated]*

### @reecebrowne — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/Stirling-Tools/Stirling-PDF/pull/2433#issuecomment-2541877867)

> Hi there. Thanks for your reply, that all makes perfect sense! If you could make those icons bigger that would help straight away and if there's anything else you feel you could do to bring that page a little closer visually to the UI of other pages it would be much appreciated.
> 
> I don't know how much can be done about the top toolbar in the pdfjs viewer, would it be possible to pull that functionality out into a custom toolbar, one similar to the one we have in multitool perhaps? If that is possible it would make a world of difference on bringing the presentation more in line with our existing design.
> 
>  I shall try to find you some icons that will be appropriate for these functions and send them across.
> 
> Thanks again for your contributions!

### @omar-ahmed42 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/Stirling-Tools/Stirling-PDF/pull/2433#issuecomment-2544013352)

> > A further potential improvement would be to have the "apply redaction" button (currently save Icon) appear next to selected text in the page
> 
> This is actually a fantastic improvement! I might take a look at it but I think this might take some time but that's okay
> 
> > Additionally there is a minor bug with the delete/colour select toolbar. Currently it is quite easy for a redaction box/text selection to appear over the toolbar for nearby redactions making the buttons impossible to click
> 
> Great observation! I will take a look it

### @reecebrowne — 1 reactions  
`👍 1`  ·  [link](https://github.com/Stirling-Tools/Stirling-PDF/pull/2433#issuecomment-2544020647)

> > I feel like the first icon you mentioned fits our use case perfectly, but I might go with the second one as it would be more intuitive to almost all the users
> Yes I think the check is probably the better choice, lets go with that
> 
> > > I think this is better placed directly next to the text selection icon and only shown when text select mode is active to make it clear it is related only to that feature and serves no purpose on box redaction
> > 
> > To make sure I understand, let's visualize them as follows:
> > 
> > 1. [text-selection-icon][check-icon_hidden][area-selection-icon]
> > 2. On enabling text-selection mode:
> >    
> >    * [text-selection-icon][check-icon-visible][area-selection-icon]
> >      Is that is or did I miss something?
> 
> Yes I think that will just help to make it really obvious that button is related to the text selection feature and only activates when in that mode. I think maybe consider trying green for that button to make it clearer it's a "confirm" action. Feel free to go with your gut on what feels clear and looks good on that though as it may look off in practice.

### @reecebrowne — 1 reactions  
`👍 1`  ·  [link](https://github.com/Stirling-Tools/Stirling-PDF/pull/2433#issuecomment-2544021280)

> > > A further potential improvement would be to have the "apply redaction" button (currently save Icon) appear next to selected text in the page
> > 
> > This is actually a fantastic improvement! I might take a look at it but I think this might take some time but that's okay
> > 
> 
> Yeah I don't think it's necessary to the feature, just a nice UI upgrade, so perhaps that could be a suggestion for additional improvements in a new branch after release if you feel it may be a bigger job.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
