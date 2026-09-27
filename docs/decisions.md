# Decisions

Why things are the way they are, so nobody relitigates them at 4am.

## Scope

**uOttawa only, not Carleton.** Considered supporting both, and separately
considered letting one student mix courses from both with O-Train travel time
between campuses. That second version was the genuinely original idea and is the
right long-term direction, but it is a second scraper plus a travel model, which
does not fit the weekend. Carleton support without cross-registration adds work
and no new capability, so it was dropped entirely.

**The AI does language, the algorithm does correctness.** Generating
conflict-free schedules is a constraint search. Using a model for it would be
slower, less reliable and impossible to defend to judges. The model handles the
three things it is actually good at: reading intent, summarizing reviews, and
explaining a result.

## Architecture

**Two generators.** `backend/src/generator.js` is authoritative.
`planner/src/lib/generator.ts` is a deliberate duplicate. It powers offline mock
mode so frontend work is never blocked on the backend, and it is the fallback if
the server dies during judging. The cost is keeping them in step; the benefit is
that the demo cannot be killed by one process.

**Units, not sections, are the unit of choice.** A scraped section can meet at
several times, and uOttawa ties a lecture to its DGD and lab by section-code
letter. Modelling "one meeting pattern" as the atom made the group constraint
awkward, so the generator picks *units* (all meetings sharing a course and
section code) and enforces that every unit in a course option shares a group.

**Options are deduplicated by lecture set.** The first working version returned
five schedules that differed only by which DGD you took, which is five tabs
showing the same decision. Now each tab is a distinct set of lectures, and
changing a lab or DGD is a separate, smaller action on the block itself.

**Lectures are not swappable in place.** A group has one lecture, so "other times
for this lecture" would always be empty. The hover card points to the option tabs
instead.

**Percentage-based grid.** The schedule fills the screen with no scrolling, which
pixel-per-minute positioning cannot do at arbitrary heights. Blocks are placed as
percentages of the visible day, and the visible range auto-fits to the earliest
and latest class, so there is no dead space at 8am when nothing starts before 10.

## Data

**Cache everything, disk included.** uoCampus is slow and rate limited, and
restarts during a hackathon are constant. Subjects 1h, terms 12h, professors 7
days, in `.cache/`.

**Sample data is a first-class path, not a hack.** `USE_SAMPLE_DATA=true` gives a
complete working app. Venue wifi and university sites both fail at the worst
time. Every response says whether the data is live.

**Term dates are guessed then corrected.** The uoCampus class search does not show
term start and end dates, but scraped meetings carry them. `terms.js` guesses from
the season and overwrites itself the moment a real scrape lands.

**Only weekly events become busy blocks on .ics import.** A one-off appointment
should not block every week of the term. Skipped events are counted and reported.

## Security and privacy

**No key reaches the browser.** Gemini runs server-side. The Google access token
stays with Auth0 and is read by the backend through the Management API with a
single scope, `read:user_idp_tokens`.

**Calendar writes go to a new calendar.** Every push creates a calendar named for
the term, so nothing in the student's existing calendar can be overwritten, and
they can delete the whole thing in one click.

**Rate My Professors is treated as borrowed.** Cached hard, few requests, failures
degrade to "no rating" rather than breaking the page. Framed honestly as a
prototype.

## Naming

Final name: myUni.Courses, which is also the domain. "myUni" makes it about the
student's own university, which fits expanding beyond uOttawa, and it avoids the
university's trademarks. `.courses` is a GoDaddy Registry extension. The name went
Profound, then uschedule.ai, then myUni.Courses.

Earlier working name Profound: "prof" plus "found", and it points at the professor
ratings that make this different from existing tools. Alternatives considered:
Sorted, Coursecorrect, Tessel, uSlotted. Avoid anything containing "uOttawa" or
"GeeGees", which are the university's trademarks.
