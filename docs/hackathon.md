# Hack the Hill III

Sept 25 to 27, 2026, University of Ottawa. Hacking began Friday 10:00 PM.

Sources: `https://tracker.hackthehill.com/resources` and the Devpost page. The
slide deck said hacking starts at 9:30 PM and the resources page said 10:00 PM.
10:00 PM matches the stated 36-hour window and is what we went with.

## Deadlines

| When | What |
|---|---|
| Friday 10:00 PM | hacking begins, first commit |
| Saturday 3:00 PM | CGI challenge twist drops (only matters if doing CGI) |
| Saturday midnight | draft Devpost submission due |
| Sunday 10:00 AM | final submission due |

Devpost requires a GitHub link and says commits are reviewed to confirm the work
happened during the event. Commit early and often from 10 PM Friday.

## Categories this project targets

**General Challenge** ($500 / $300 / $200). Main track. Judged on Technical
Execution 15, Idea and Impact 10, Design and Usability 10, Learning 5, plus up to
5 bonus for presentation.

**MLH Gemini** (swag kits). Qualifies: preference parsing, professor summaries and
schedule explanations all use the Gemini API.

**MLH Auth0** (wireless headphones). Qualifies once the Auth0 tenant is live.
Authentication alone is enough; the Google Calendar write is extra.

**MLH GoDaddy Registry** (gift card). Register a domain. Low effort, do it.
Extensions offered in past events: `.co`, `.biz`, `.courses`, `.study`, `.us`,
`.wiki`, `.design`, `.club`. Confirm the current list with the promo code.
Shortlist: `profound.courses`, `sorted.courses`, `coursecorrect.co`.

**Best UI/UX** and **Best Educational** if those mini-challenges are real. They
were on the opening slides but never documented. Ask an organizer.

Not applicable: Civic Tech (a university is not government, forcing it would
hurt), CGI (separate brief).

## The pitch

Lead with the differentiator, not the category. Schedule builders for uOttawa
already exist: schedulo.pro shows professor ratings, uoPlan and uSchedule generate
conflict-free timetables. What none of them do:

1. **Preferences in plain English**, turned into weights you can see and correct.
   The sliders animating to what the AI understood is the strongest single moment
   in the demo.
2. **Explaining the trade-off**, not just showing a number. "Your profs average
   4.1, but it costs you an 8:30 Monday."
3. **Review summaries**, not just a 3.2 rating.
4. **Swapping one lab or DGD** without rebuilding the week.
5. **Planning around your real life**, by importing work shifts from a calendar.

Demo order that works: add courses, type the preference sentence, watch the
sliders move, build, hover a professor, switch tabs, swap a DGD, push to Google
Calendar.

## Questions judges are likely to ask

**How do you stop the AI making things up?** It never sees the schedule. It gets
facts computed by the generator and phrases them. The schedule building itself is
a search algorithm, not a model.

**Where does the professor data come from?** Rate My Professors' public GraphQL
endpoint, the one their own site calls. It is undocumented and their terms
discourage automated access, so we cache for a week and send as few requests as
possible. A production version would need their permission or a different source.
Do not oversell this; say it plainly.

**Is the course data real?** Yes, scraped live from uoCampus. If the demo is
running on sample data because their site is slow, say so rather than implying
otherwise.

## Cut before you run out of time

Dropped early and worth staying dropped unless there are hours to spare:

- Carleton support. Without cross-registration it is a second scraper for no new
  capability. Listed as a next step in the pitch instead.
- Cross-campus commute time between uOttawa and Carleton. The most original idea
  we considered, and the most work. Mention it as where this goes next.
- Waitlist length. uoCampus does not publish it. The UI says so.
