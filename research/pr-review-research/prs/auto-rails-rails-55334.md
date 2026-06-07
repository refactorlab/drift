# rails/rails #55334 — Structured Event Reporting in Rails

**[View PR on GitHub](https://github.com/rails/rails/pull/55334)**

| | |
|---|---|
| **Author** | @adrianna-chang-shopify |
| **Status** | ✅ merged |
| **Opened** | 2025-07-14 |
| **Repo** | curated review-culture seed |
| **Diff** | +1702 / −0 across 13 files |
| **Engagement** | 32 conversation · 78 inline review comments |

## Top review comments (ranked by reactions)

### @adrianna-chang-shopify — 6 reactions  
`👍 2 · ❤️ 3 · 🚀 1`  ·  [link](https://github.com/rails/rails/pull/55334#issuecomment-3132618821)

> > Or we can go back to storing the keys as symbols, rather than possibly having :some_tag and "some_tag" in the payload
> 
> The original implementation had tag keys + context store keys as symbols, and left the payload intact, but it sounds like we want to consistently use symbols, including for payload keys, since these should be finite, known values. On board with dropping HWIA, the overhead is far more significant than I thought 😅 I'm going to change this to convert keys to symbols across the board.

### @palkan — 6 reactions  
`👍 5 · 👀 1`  ·  [link](https://github.com/rails/rails/pull/55334#issuecomment-3137417603)

> Hey there,
> 
> Thanks for working on this!
> 
> I’ve been following this PR from the very and want to drop my two cents.
> 
> Structured logging (which this PR claims to implement) is a valuable (and, IMO, must-have) addition to Rails.
> 
> However, the direction in which this PR is moving seems concerning to me: we diverted from the original goal towards event-driven architecture mixing too many use cases (especially, with custom events) and logging/instrumentation is not longer being the primary one:
> 
> - I strongly disagree with the decision of dropping log levels (and still having `debug` logs); warnings make sense; error logs make sense (the simplest but important use case is colored output); **it’s not a solution to structured logging problem if we can’t provide familiar experience.** (have some thought on that, below).
> 
> - I think, the functionality should be focused on telemetry/observabilty (incl. business-oriented) and not being a generic events bus (with custom events and so on); those are two different things (at least, conceptually); people have already started talking about this feature as a “model callbacks replacement” (and that worries me)—is this the goal of this feature? Maybe, that could be the next phase when the telemetry part is done.
> 
> (Sorry for grunting like Abe Simpson)
> 
> Speaking of **structured logging**, having a dedicated event type and the format (that must include the `level` field) is an option. And then making it possible to switch `Rails.logger` to use events (I know, there are a lot of questions have been raised about backward compatibility in the issue). … *[truncated]*

### @adrianna-chang-shopify — 4 reactions  
`👍 1 · ❤️ 2 · 🎉 1`  ·  [link](https://github.com/rails/rails/pull/55334#issuecomment-3179315559)

> Hey @palkan -- yeah, that PR definitely needs a bit of cleaning up ahead of being opened. Mostly wanted to showcase the direction we could move in for native structured event reporting in the Rails libraries (and verify that Action Pack / Active Job work with the way we're resetting context for the Event Reporter in this PR). I'll definitely take a look at your feedback more in depth when we get ready to bring that in officially. You raise great points (duplication between the subscribers was something I'd noted as well).
> 
> > [Adding params to the event payload](https://github.com/Shopify/rails/blob/59022f7c50a622a41e23880b72b370dafb19380e/actionpack/lib/action_controller/structured_event_subscriber.rb#L23) raises a question of security: should events contain potentially sensitive information? Do we need some kind of filtering or we should avoid emitting such data?
> 
> @zzak has been working on filtering params (https://github.com/Shopify/rails/pull/37, https://github.com/Shopify/rails/pull/38), probably best to land that first. Although IIRC sensitive data is already scrubbed e.g. from the request before it hits the log subscribers? We should verify.
> 
> ---
> 
> @rafaelfranca let me know if anything else is missing on your end from this initial PR. I'd like to work on more extensive documentation / additions to the guides, and those event subscribers in a follow-up. And @zzak has some work on top of this as well ❤️

### @ioquatix — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/rails/rails/pull/55334#issuecomment-3124445260)

> LGTM, happy to give a detailed review if that's helpful.

### @kigster — 2 reactions  
`👍 2`  ·  [link](https://github.com/rails/rails/pull/55334#issuecomment-3124708673)

> Thank you!!
> 
> This has been missing from Rails for a long long time and I'm excited to see it. For instance, back in Wanelo days we used this gem to deal with events and subscriptions: [ventable](https://github.com/kigster/ventable).
> 
> ## Reflections on using Events in Rails
> 
> I've been using events as first class citizens in Rails for a decade or more, and so perhaps I can add some useful context here.
> 
> ## Maybe we can haz Ruby Classes? 
> 
> I don't think it's an overkill to either allow or require to have an event class representing each event, eg `app/events`. Such events could follow a similar pattern to models and controllers, and be created as subclasses of eg `ActiveEvent::Base`? 
> 
> Each must also have a standardized JSON representation so it can be broadcast via RabbitMQ or any other pub/sub system: in fact the JSON proposed here is great!
> 
> **Advantage** of having Ruby classes representing the events would be:
> 
> - natural naming and name spacing for events (eg `app/events/auth`)
> - ability to write tests for the events
> - ability to have a sub-hierarchy of events share some behavior without affecting all of the events (modeled as inheritance)
> - validations for the generated JSON or other requirements (for example: a queue or topic name), in fact even this could be possible: `include ActiveModel::Validations`
> 
> If the class representation were made optional, and the class-less JSON only events are also allowed, then I don't see any disadvantages of adding support for classes wrapping the JSON events with the potential for additional logic.
> 
> ## Tagging and Validations
> 
> It was ve … *[truncated]*

### @rafaelfranca — 2 reactions  
`👍 2`  ·  [link](https://github.com/rails/rails/pull/55334#issuecomment-3138425192)

> My idea was that the logger lines emitted to the framework (in other words, the `LogSubscribers` we have) would emit events as well. Maybe have a different class of `ActiveSupport::Notification` subscribers that emit events instead of log entries.
> 
> We have no plans to change `Rails.logger` to emit events. Applications that use `Rails.logger` but want the log entries to be structured would need to change the `Rails.logger` calls to use the event API.
> 
> I realize that this would make the structure logging opt-in, but most `Rails.logger` calls in applications are libraries aren't compatible with structured loggers anyway.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
