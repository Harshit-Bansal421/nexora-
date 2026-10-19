import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { DB_NAME } from "../src/constants.js";
import { User } from "../src/models/User.model.js";
import { Page } from "../src/models/Page.model.js";
import { Post } from "../src/models/post.model.js";
import { Comment } from "../src/models/Comment.model.js";
import { JoinRequest } from "../src/models/Joinrequest.model.js";
import { Notification } from "../src/models/Notification.model.js";

dotenv.config({ quiet: true });

const VERSION = "nexora-human-test-seed-v2";
const PASSWORD = "Test@12345";
const DAY = 86_400_000;
const USERS = [
  ["Naruto Uzumaki", "naruto@nexora.test", "naruto_u", "usually optimistic. currently losing a fight with calculus."],
  ["Sakura Haruno", "sakura@nexora.test", "sakura_h", "bio major | notes are color coded, yes all of them"],
  ["Monkey D. Luffy", "luffy@nexora.test", "luffy_d", "here for the people and the canteen samosas"],
  ["Roronoa Zoro", "zoro@nexora.test", "zoro_r", "gym before 8am. regretting it by 8:15."],
  ["Light Yagami", "light@nexora.test", "light_y", "If I plan the week properly maybe the week will cooperate."],
  ["Mikasa Ackerman", "mikasa@nexora.test", "mikasa_a", "quietly getting things done."],
  ["Tanjiro Kamado", "tanjiro@nexora.test", "tanjiro_k", "happy to share my lecture notes, just ask"],
  ["Gojo Satoru", "gojo@nexora.test", "gojo_s", "cs student. my confidence is inversely proportional to my test results"],
  ["Izuku Midoriya", "deku@nexora.test", "deku_m", "i make notes about the notes"],
  ["Edward Elric", "edward@nexora.test", "edward_e", "engineering, chemistry, and very small lab accidents"],
  ["Anya Forger", "anya@nexora.test", "anya_f", "first year. the library has good snacks."],
  ["Shoyo Hinata", "hinata@nexora.test", "shoyo_h", "volleyball after lectures if anyone's around"],
  ["Kiki", "kiki@nexora.test", "kiki_f", ""],
  ["Howl Jenkins", "howl@nexora.test", "howl_j", "late to everything except the 11:59 deadline"],
  ["Chihiro Ogino", "chihiro@nexora.test", "chihiro_o", "still figuring campus out, send food recommendations"],
  ["Sailor Moon", "usagi@nexora.test", "usagi_m", "somehow passed stats. don't ask how"],
  ["Yor Forger", "yor@nexora.test", "yor_f", "joining the evening fitness walks when class allows"],
  ["Spike Spiegel", "spike@nexora.test", "spike_s", "will read the paper later (probably)"],
  ["Nami", "nami@nexora.test", "nami_n", "keeping track of every group expense"],
  ["Sokka", "sokka@nexora.test", "sokka_w", "not a science major but i have opinions about the lab timetable"],
  ["Tohru Honda", "tohru@nexora.test", "tohru_h", "if you need a study buddy just ping me"],
  ["Levi Ackerman", "levi@nexora.test", "levi_a", ""],
  ["Frieren", "frieren@nexora.test", "frieren_s", "I started this assignment three weeks ago. It's fine."],
  ["Denji", "denji@nexora.test", "denji_p", "cheap lunch spots. please. this is not a joke"],
  ["Mabel Pines", "mabel@nexora.test", "mabel_p", "craft night after midterms?"],
  ["Aarav Mehta", "aarav@nexora.test", "aarav_m", "ECE, chai, and trying to keep my Git branches tidy"],
  ["Isha Rao", "isha@nexora.test", "isha_r", "internship applications are humbling"],
  ["Kabir Shah", "kabir@nexora.test", "kabir_s", "plays tabla. learning Python slowly."],
  ["Meera Nair", "meera@nexora.test", "meera_n", "library seat near the window is taken (by me)"],
  ["Dev Patel", "dev@nexora.test", "dev_p", "mostly here to read, occasionally remembers to reply"],
  ["Rin Okumura", "rin@nexora.test", "rin_o", "design elective, bad sleep schedule"],
  ["Yuki Sohma", "yuki@nexora.test", "yuki_s", "I can review resumes this weekend"],
  ["Aoi Kanzaki", "aoi@nexora.test", "aoi_k", ""],
  ["Kento Nanami", "kento@nexora.test", "kento_n", "placement prep, no calls before 10"],
  ["Mina Ashido", "mina@nexora.test", "mina_a", "campus fest volunteer. forms are in my bio"],
];

const COMMUNITIES = [
  ["Hidden Leaf Study Circle", 0, "open", [0, 1, 4, 5, 6, 8, 10, 14, 20, 25, 26, 28, 31, 33]],
  ["Straw Hat Coders", 2, "open", [0, 2, 7, 8, 10, 11, 13, 17, 18, 25, 26, 27, 29, 33, 34]],
  ["Alchemists' Lab", 9, "open", [1, 4, 5, 6, 9, 12, 14, 19, 21, 25, 27, 28]],
  ["Demon Slayer Fitness Club", 3, "open", [2, 3, 5, 10, 11, 14, 16, 20, 23, 24, 28, 30, 32, 34]],
  ["Soul Society Book Club", 6, "private", [0, 1, 4, 6, 8, 13, 14, 18, 20, 22, 25, 29, 31, 33]],
  ["U.A. Hackathon Crew", 7, "open", [0, 2, 7, 8, 10, 11, 17, 19, 25, 26, 27, 29, 30, 33, 34, 31]],
  ["Konoha Campus Lost & Found", 5, "open", [0, 1, 3, 5, 6, 10, 14, 20, 22, 28, 32]],
  ["Night Owls Placement Prep", 4, "private", [1, 4, 7, 8, 13, 17, 18, 25, 26, 27, 29, 31, 33, 34, 30, 28, 20, 14]],
];

const HUMAN_THREADS_A = [
  { page: 0, owner: 8, topic: "Academic", title: "anyone get a photo of the trees example from monday", body: "the projector died right when he started rotations and i copied half a diagram. if you have the board photo could you send it?", people: [6, 1, 25, 8, 4, 6, 28, 1, 14], comments: [
    "I took one, but the last arrow is blurry. I'll check if the original is clearer.",
    "I wrote down the sequence: left rotation on 30, then right on 40. Not sure I got the labels right.",
    "Found the class drive upload. It's under Week 6, not Week 5 for some reason.",
    "The example uses 30 as the root before balancing, if that helps while you wait.",
    "sending the photo now, the corner with the final tree is readable at least",
    "yep that's the one, the 20 goes under 30 after the second rotation",
    "I added a cleaner redraw to the shared notes. Please check my arrows before using it.",
    "Checked them against the worksheet, both rotations are correct.",
    "ty, finally makes sense"
  ] },
  { page: 0, owner: 4, topic: "Academic", title: "quiz room changed or is the group chat guessing again", body: "calendar says B-204 but three people are saying the old hall. anyone actually checked with the TA?", people: [1, 6, 25, 4, 8, 6, 14, 1, 28], comments: [
    "The TA posted B-204 on the course page about ten minutes ago.",
    "I only saw the old room on the printed timetable by the stairs.",
    "Just asked after class; B-204 is right, the old hall is booked for a seminar.",
    "Thanks, I was about to head to the wrong building.",
    "Can someone share the announcement link? Mine still shows the old one.",
    "It refreshed after I signed out and back in. Their portal is so odd.",
    "Screenshot is in the study group chat now, date and room both visible.",
    "confirmed with the TA again, quiz starts at 11 not 10",
    "B-204 it is. I'll get there early"
  ] },
  { page: 6, owner: 5, topic: "Life", title: "blue bottle left outside the old library", body: "steel bottle with a small dent near the cap. I checked the front desk but they haven't seen it. has anyone picked it up?", people: [0, 10, 1, 5, 22, 14, 0, 10, 1], comments: [
    "I saw one on the low wall beside the canteen around lunch.",
    "Was there a sticker on the bottom? I moved a bottle from the rain to the library steps.",
    "No sticker, just a dent. That might be mine, I was there at 12:30.",
    "I can swing by the steps after lab and check if it's still there.",
    "It's at the reception desk now, the guard brought it in when it started raining.",
    "That's mine, the cap has a tiny orange mark inside. Heading over.",
    "Picked it up, all good. Thanks for keeping it safe.",
    "I'll put a note on the lost-and-found board so the desk knows it was claimed.",
    "found!! appreciate you all"
  ] },
  { page: 5, owner: 7, topic: "Tech", title: "we need one more person for the bus tracker hackathon", body: "we've got the route data and a very rough map. Someone who likes frontend or visual design would save us from the current rectangle situation.", people: [2, 11, 25, 7, 26, 18, 2, 29, 25], comments: [
    "I can do the map view. React is fine, but I haven't used the campus API yet.",
    "I can test it on Android if you need someone to break the layout.",
    "The API docs say stop IDs are strings, not numbers. We lost half an hour to that.",
    "Nice, let's meet in the lab at 5 and decide who's doing what.",
    "can't do 5, lecture ends at 5:20. is 6 okay?",
    "six works, I'll book the small project room",
    "I'll bring the data export; the live endpoint rate-limits every few minutes.",
    "I made a quick color palette, nothing fancy. Link is in the drive.",
    "rectangle situation has been upgraded to mildly rounded rectangle"
  ] },
  { page: 7, owner: 26, topic: "Career", title: "cover letter has been open in a tab for three days", body: "I keep changing the first paragraph instead of submitting the thing. Do recruiters actually care about a cover letter for summer internships?", people: [30, 4, 25, 26, 8, 30, 14, 4, 27], comments: [
    "For the ones I applied to, only two even had a cover letter field.",
    "I wrote three sentences about why that team, then stopped editing. It was fine.",
    "My mentor said to mention one specific project from the company, not repeat the resume.",
    "That helps. Mine is currently a second resume with more adjectives.",
    "Don't send it to the generic inbox unless they ask; the portal is easier to track.",
    "I cut the paragraph in half and it reads less like a speech now.",
    "Submitted mine last night with one typo, so at least yours will be better.",
    "The career cell has a walk-in review Wednesday, they helped me trim mine.",
    "pressed submit. closing the tab before i change it again"
  ] },
  { page: 2, owner: 9, topic: "Academic", title: "lab report says relevant observations, how much raw data is that", body: "Our measurements filled two pages and the rubric isn't clear about attachments. Do you include every reading or just the summary table?", people: [6, 19, 9, 27, 1, 6, 19, 9, 28], comments: [
    "TA told our section to attach the table and keep the notebook pages with us.",
    "We included all readings in an appendix last semester and got no comments either way.",
    "I asked during office hours; raw readings are required if they don't fit in the main table.",
    "Do we need to add units to each column or is the heading enough?",
    "Heading is okay, but label the graph axes separately. They took marks off mine.",
    "I added the raw table as a one-page appendix, probably the safest version.",
    "The sample report on the portal has the same format if you scroll past the intro.",
    "thanks, found it under resources. Their menu is hiding half the files",
    "units in headings, raw table at the end. submitted"
  ] },
  { page: 0, owner: 28, topic: "Academic", title: "quiet study table around six, anyone joining", body: "I'm going to the back corner on the second floor with DBMS notes. Bring your own snacks because the vending machine is still empty.", people: [6, 25, 8, 14, 1, 6, 28, 25, 8], comments: [
    "I'll come after my tutorial, probably 6:15.",
    "Can you save the chair nearest the plug? laptop battery is cooked.",
    "I have the normalization worksheet if someone wants to compare answers.",
    "I'll bring my notes on indexes. They're messy but readable.",
    "the back corner is taken by a group right now, we're at the window instead",
    "window table found, thanks. two seats left",
    "Leaving in ten, my bus is early today.",
    "I got the vending machine to take my coin and then it returned it.",
    "good session, did more than I expected"
  ] },
  { page: 1, owner: 7, topic: "Tech", title: "my merge says clean but half the styles disappeared", body: "I resolved a conflict in the shared stylesheet and now the page looks like plain HTML. Git says there are no changes left to commit. what am I missing?", people: [25, 29, 7, 2, 18, 25, 7, 29, 26], comments: [
    "Check the commit diff, it can be clean while the wrong side of the conflict got saved.",
    "Did you take the CSS file from main or your feature branch during resolve?",
    "I accepted the incoming version for the whole file. I think that was wrong.",
    "Open the merge commit and compare it with the last good version before changing more.",
    "also clear the browser cache after you fix it, mine held the old bundle",
    "The diff shows it deleted every rule below the media query. Restoring now.",
    "Pushed the fix, thank you. I should stop clicking accept all.",
    "I saw the PR, the spacing looks back to normal.",
    "saved myself a screenshot for next time"
  ] },
  { page: 3, owner: 34, topic: "Life", title: "volunteers needed for fest setup on thursday", body: "We need a few people for the afternoon desk and putting signs up near the south gate. Signup closes tonight; shifts are about an hour.", people: [11, 23, 34, 14, 16, 11, 23, 34, 30], comments: [
    "I can take the 2pm desk slot, my class ends at 1:30.",
    "put me down for signs, I have a roll of tape already",
    "The form asks for a student ID but the last digit field keeps rejecting mine.",
    "Try removing the space before the number, it accepted mine after that.",
    "I'll do the later slot if someone can cover 3 to 4.",
    "Added you both; the form finally loaded on desktop.",
    "Where do we collect the badges?",
    "At the south gate table, Mina has the envelope.",
    "I can bring extra markers"
  ] },
  { page: 0, owner: 8, topic: "Academic", title: "how do you stop blanking during a viva", body: "I know the material when I'm revising, then someone asks me to explain it out loud and my mind goes quiet. Any practice that helped?", people: [6, 4, 25, 8, 30, 6, 14, 25, 4], comments: [
    "We did ten-minute mock rounds in pairs, no slides and no notes.",
    "Practicing the first sentence helped me most. The rest usually came back.",
    "I recorded myself once and hated it, but noticed I speak too fast.",
    "Could we do a practice circle before Friday? I'm not the only one nervous.",
    "I'll ask the tutor if the seminar room is free after class.",
    "Room is booked for 4:30; bring one question each.",
    "I tried answering while walking and it felt less like an exam.",
    "The timer idea is good, but give each person a minute to think first.",
    "showed up, survived, even remembered the diagram"
  ] },
  { page: 7, owner: 30, topic: "Career", title: "resume looks cramped on a phone screen", body: "It's one page on my laptop, but on mobile the projects section looks like a wall of text. Is that a bad sign or just the PDF preview?", people: [26, 27, 30, 4, 25, 27, 30, 26, 18], comments: [
    "PDF preview zooms weirdly. Try opening it in Drive before adjusting the spacing.",
    "Your bullet lines wrap after six words; shortening two should help.",
    "I moved coursework under education and gave projects a little breathing room.",
    "Can you send the file without your phone number? happy to check the layout.",
    "I changed the font size from 9 to 10 and removed the long summary.",
    "Now it reads fine at 100%, thanks for pointing that out.",
    "Career cell has a scanner view too, you can check it there.",
    "I'll ask them Thursday; applications aren't due until next week.",
    "less cramped now, nice"
  ] },
  { page: 0, owner: 25, topic: "Academic", title: "what are people using for the DBMS assignment", body: "The brief says any SQL database, but the lab machines have two versions installed and my laptop has a third. Are we meant to match the lab?", people: [8, 6, 25, 27, 1, 8, 14, 25, 6], comments: [
    "Tutor said PostgreSQL, version doesn't matter if the queries run.",
    "Our lab image is 15.4; I checked after class.",
    "SQLite worked for me until the stored procedure part, then I switched.",
    "Are we submitting screenshots or the .sql file too?",
    "Both, according to the checklist on page two.",
    "The checklist link in the brief is broken, anyone have the PDF?",
    "Uploaded a copy to the course drive, file name ends in final2 because of course it does.",
    "got it. thanks for sharing the actual one",
    "I installed Postgres 16 and all queries passed"
  ] },
  { page: 3, owner: 14, topic: "Life", title: "trying to keep lunch under a hundred rupees near campus", body: "The place by the gate raised prices again. Anyone know a filling option that isn't just biscuits between lectures?", people: [22, 18, 14, 11, 16, 22, 23, 18, 14], comments: [
    "South canteen has rice and dal for 65 before 2pm.",
    "There's a dosa cart behind the stationery shop, cash only though.",
    "I tried the thali near the bus stop; portions are decent at 80.",
    "Does the cart stay open after 4? my lab ends late.",
    "usually till 5:30 unless it rains",
    "Their lemon rice is good and it comes with curd.",
    "I went today, the cart was there and the queue moved fast.",
    "Adding that to my map because I keep forgetting the side lane exists.",
    "found lunch, crisis postponed"
  ] },
  { page: 2, owner: 27, topic: "Academic", title: "where did the chemistry lab move the titration stands", body: "The cupboard that usually has them is full of glassware now. Practical starts in half an hour and I'm doing laps of the lab.", people: [9, 19, 27, 5, 6, 9, 19, 27, 1], comments: [
    "They moved them to cabinet C by the sink after the inspection.",
    "C has burettes but no clamps on the top shelf.",
    "Look in the lower drawer, that's where they put the stands yesterday.",
    "Found four there. One clamp is loose, tell the technician.",
    "I'll grab one too, our bench is missing the base plate.",
    "Tech said return them to C after class; the other cupboard is being cleaned.",
    "The labels are on the back of the cabinet door, tiny print.",
    "I asked for tape so we can label the drawer properly.",
    "all set, practical started"
  ] },
  { page: 1, owner: 25, topic: "Tech", title: "does everyone commit straight to main for class projects", body: "Two of us pushed different versions of the same file and now the latest one is missing a function. What's the least chaotic workflow for a small group?", people: [7, 29, 25, 18, 26, 7, 29, 25, 2], comments: [
    "We use a branch per task and open a tiny PR, even if it's just two people.",
    "Protect main and make someone review before merging. Saves the late-night mystery.",
    "We don't have Actions set up; is a review still useful without tests?",
    "Yeah, just comparing the diff catches accidental deletions.",
    "I can show the branch settings after lecture if you're on GitHub.",
    "We made branches today and stopped overwriting each other's work.",
    "One person should own the merge when you're both touching the same file.",
    "The missing function was in the old commit, cherry-picked it back.",
    "main is protected now, nobody panic"
  ] },
];

const HUMAN_THREADS_B = [
  { page: 1, owner: 2, topic: "Tech", title: "wifi drops every time i sit in the basement lab", body: "It reconnects long enough to lose my quiz timer, then disappears again. Is this happening to anyone else or is my laptop cursed?", people: [25, 7, 2, 18, 29, 25, 2, 7, 18], comments: [
    "Same corner near the printer? The signal falls off there for me too.",
    "IT desk has a temporary access point by the stairwell.",
    "I tried that one yesterday and it held through a whole lecture.",
    "The network name ends in staff, do students have access?",
    "Use the one ending in lab; staff is password protected.",
    "I'll move closer to the stairs next time, didn't know it reached there.",
    "Temporary AP is offline this morning, they said maintenance is coming.",
    "It's back now, connected about five minutes ago.",
    "good to know, test survived"
  ] },
  { page: 3, owner: 34, topic: "Life", title: "poster deadline says week eight but the calendar says monday", body: "We have to submit the design poster and I'm getting two different dates from the brief and course calendar. Which one did the tutor confirm?", people: [23, 14, 34, 30, 11, 23, 34, 16, 14], comments: [
    "They said Monday at 5pm in the workshop, not Sunday night.",
    "Course calendar still says week 8 with no date attached.",
    "I emailed the tutor and got the same Monday answer.",
    "Does the file need to be printed by then or just uploaded?",
    "Upload the PDF; printing is only for the showcase next week.",
    "Can someone share the exact dimensions? mine keeps exporting huge.",
    "A1 portrait, 300 dpi. It's in the second page of the brief.",
    "The export preset fixed my blurry logos.",
    "uploaded with 12 mins to spare"
  ] },
  { page: 0, owner: 1, topic: "Academic", title: "anyone know the add-drop form cutoff", body: "The portal still lets me edit my timetable but the department notice says changes close soon. I want to switch one elective before it gets messy.", people: [4, 25, 1, 8, 6, 4, 28, 25, 1], comments: [
    "Registrar's page says Friday at 4pm, not end of day.",
    "My advisor told us to submit before Thursday so there's time for approval.",
    "Do you need the instructor to sign it or just your advisor?",
    "Instructor signature only if the class is full.",
    "The elective has three spots showing right now.",
    "I sent the request this morning and got an email receipt.",
    "Check spam for the receipt, mine landed there.",
    "Advisor confirmed mine just now, timetable updated.",
    "switched, no more 8am lab"
  ] },
  { page: 4, owner: 6, topic: "Academic", title: "looking for the short story list from book club", body: "I lost the note where we wrote down the next few readings. I remember one was by Tagore, but not the other two.", people: [20, 6, 14, 22, 1, 20, 6, 29, 14], comments: [
    "The next one is Kabuliwala; we said we'd keep it under 30 pages.",
    "We also mentioned The Postmaster, but that might have been for later.",
    "I have it in my notebook: Postmaster this week, Kabuliwala next.",
    "Was the meeting still Saturday in the old reading room?",
    "Saturday at 4, room 2B. I booked it yesterday.",
    "I'll bring two library copies if anyone needs one.",
    "Got the e-book link from the library portal, adding it to the group.",
    "I can bring chai, but not the leaky flask this time.",
    "noted both titles, thanks"
  ] },
  { page: 6, owner: 0, topic: "Life", title: "found a notebook with mechanics notes near hall three", body: "Brown cover, loose graph paper inside, no name on the front. I've handed it to security at the east entrance.", people: [5, 0, 10, 14, 22, 5, 0, 10, 1], comments: [
    "I think that's mine; there are pencil sketches of a pulley on page one.",
    "My lab partner lost one but theirs has a blue elastic around it.",
    "Could you check for a tiny 'A.K.' on the inside cover?",
    "No initials on this one, just a sticker from the campus store.",
    "Mine has that sticker! I'll go to east entrance before class.",
    "I told the desk there's someone coming to claim it.",
    "Picked it up, all my calculations are still there.",
    "thanks for not posting the name from the inside",
    "glad it made it back"
  ] },
  { page: 5, owner: 7, topic: "Tech", title: "our hackathon demo works locally and nowhere else", body: "The map loads on my machine but the judges' laptop gets an empty screen. We have about three hours and no idea if it's the API or our build.", people: [25, 18, 7, 29, 2, 25, 7, 26, 29], comments: [
    "Check whether the base URL is hard-coded to localhost.",
    "We did that last year. Environment variable fixed the deployed version.",
    "It is localhost. wow. fixing that now.",
    "Also check the build command uses the same env file as dev.",
    "The API key isn't loaded in the demo environment either.",
    "Added both vars and pushed a new deploy.",
    "Still white screen; console says map token invalid.",
    "Found the typo in the token name, new build is live.",
    "judges saw the buses move, calling that a win"
  ] },
  { page: 7, owner: 27, topic: "Career", title: "is a cold email to an alum weird if we share a department", body: "I found someone from our course working at a place I like. I don't want to ask for a referral out of nowhere, just a little advice on applying.", people: [30, 27, 4, 26, 25, 30, 27, 4, 18], comments: [
    "A short note asking one specific question is normal, just keep it easy to ignore.",
    "Mention where you found their profile so it doesn't read like a mass message.",
    "I asked an alum about their internship project and they replied a week later.",
    "Don't attach your resume in the first message unless they offer.",
    "Could ask what they wish they'd known before their first interview.",
    "I wrote four lines and removed the whole paragraph about my life story.",
    "Sent it. Felt less awkward than I expected.",
    "They answered with a link to the team blog, actually useful.",
    "small win, no referral request required"
  ] },
  { page: 2, owner: 9, topic: "Academic", title: "physics demo sign-up has two slots at the same time", body: "The sheet lists the pulley demo at 10:30 and the pendulum demo at 10:30 too. Are they in different rooms or did someone copy the wrong time?", people: [19, 9, 27, 6, 1, 19, 9, 27, 25], comments: [
    "Pulley is in lab 1, pendulum is in the lecture hall.",
    "The sheet forgot to show rooms in the header row.",
    "I checked with the demonstrator, both times are correct.",
    "Do we need to bring the lab manual for the pulley one?",
    "Just goggles; they have the manual on the bench.",
    "I added rooms to the shared sheet so nobody has to guess.",
    "Pendulum got moved to 11:15, announcement was posted after this.",
    "I changed the sheet and added the notice link.",
    "nice, my calendar is fixed"
  ] },
  { page: 3, owner: 23, topic: "Life", title: "who has the club expense split from last month", body: "I paid for the poster prints and tape, but I can't find the sheet with everyone's share. It's not urgent, just balancing my notes.", people: [18, 23, 34, 11, 16, 18, 23, 30, 34], comments: [
    "I have the receipt photo; prints were 420 and tape was 68.",
    "I paid 100 at the shop, does that count as part of the split?",
    "Yes, I noted that against your share in the sheet.",
    "Can you resend the link? the old one says access denied.",
    "Updated permissions, use your college email this time.",
    "I'll send 82 tonight after checking the UPI history.",
    "The final total is 488, divided by six people.",
    "Got the transfer, thanks. I've marked the row.",
    "sheet saved somewhere less mysterious now"
  ] },
  { page: 4, owner: 20, topic: "Academic", title: "book club can we switch saturday's chapter", body: "The library copy of the book is checked out until Monday, and half of us haven't found the ebook. Could we read the shorter story in the collection instead?", people: [6, 22, 20, 14, 1, 6, 20, 29, 22], comments: [
    "The Postmaster is available in the library anthology, it's about 20 pages.",
    "I'm fine switching, but can we keep the same meeting time?",
    "Saturday at four still works for me.",
    "I found the ebook in the archive, but the scan is missing the last page.",
    "The anthology is on shelf 891.4, two copies by the window.",
    "I'll bring one copy and print the story for anyone who needs it.",
    "Let's do the shorter one and save the novel for next week.",
    "No spoilers in the group chat please, some of us are behind.",
    "chapter swapped, Saturday unchanged"
  ] },
  { page: 1, owner: 29, topic: "Tech", title: "bus tracker jumps across campus when the map zooms", body: "The marker looks right until I zoom in, then it lands on the other side of the road. Coordinates are coming from the endpoint in decimal degrees.", people: [7, 25, 29, 18, 2, 7, 29, 26, 18], comments: [
    "Are you rounding to two decimals before passing it to the map?",
    "Check whether your latitude and longitude got swapped.",
    "They are right in the log, but the marker moves about 200 metres.",
    "Map library expects [longitude, latitude], not latitude first.",
    "oh wow we passed lat first",
    "Swapped them and now it lines up at every zoom level.",
    "The stop near the stadium is still off by one pin.",
    "That's a separate bad coordinate in the test data, I corrected it.",
    "bus is no longer in the parking lot"
  ] },
  { page: 6, owner: 10, topic: "Life", title: "green umbrella left near the auditorium seats", body: "It's folded by the door on the left, plain green with a wooden handle. I didn't see it when the event started, so it may belong to someone who just left.", people: [0, 5, 10, 14, 22, 0, 10, 5, 1], comments: [
    "I left one there after the 1pm lecture, handle has a small crack.",
    "This one looks intact in the photo, different umbrella maybe.",
    "I put it in the lost-and-found box at reception.",
    "Does the auditorium desk stay open after 6?",
    "Guard at the east entrance can unlock the box until 8.",
    "Owner found it, the crack was under the fabric wrap.",
    "I picked it up, thanks for the heads-up.",
    "I'll update the note on the box so it isn't counted missing.",
    "rain can start now, umbrella recovered"
  ] },
  { page: 0, owner: 14, topic: "Academic", title: "exam timetable has my elective in two places", body: "The PDF puts environmental studies on Tuesday at 9, but the portal shows Wednesday at 1. I have another paper Wednesday, so please tell me one is old.", people: [4, 25, 14, 8, 6, 4, 1, 25, 28], comments: [
    "Department notice from yesterday says Wednesday at one.",
    "The PDF footer says revised last month, so portal should be newer.",
    "I emailed the exam office; no reply yet.",
    "My class rep has a signed sheet with Wednesday listed.",
    "Can you send the notice? I'd like to ask the other section too.",
    "Here, photo from the department board, date is visible.",
    "Class rep confirmed the same time to our group.",
    "I'll stop studying for Tuesday, thank you.",
    "checked with office, Wednesday is final"
  ] },
  { page: 5, owner: 26, topic: "Tech", title: "pitch needs to fit in three minutes and ours is seven", body: "Our project explanation keeps turning into a feature tour. Which part would you cut first: architecture slide, user story, or the live demo?", people: [7, 25, 26, 29, 2, 7, 26, 18, 25], comments: [
    "Keep the user story and one clear demo path; cut the architecture detail.",
    "The judges asked us about impact last year, not the folder structure.",
    "We have two demos, one for desktop and one for phone.",
    "Pick whichever shows the main idea faster, avoid switching devices.",
    "Can we leave architecture as one diagram in the appendix?",
    "That'll work. We trimmed the intro and rehearsed to 2:45.",
    "Run it once without explaining every click, the screen should do some work.",
    "Our video backup is 45 seconds in case wifi dies.",
    "three minutes exactly, nobody breathed"
  ] },
  { page: 7, owner: 4, topic: "Career", title: "placement mock interview asked about a project i forgot i built", body: "I froze when they asked why I used that database in my second-year app. I know the answer, just couldn't pull it together on the spot.", people: [30, 27, 4, 26, 25, 30, 4, 18, 27], comments: [
    "Write a one-minute version of each project and practice out loud.",
    "They may ask why not another database, so have one tradeoff ready.",
    "I practiced with a friend who doesn't code; explaining it plainly helped.",
    "Could do a mock round after class Friday if anyone wants in.",
    "I'll bring a list of questions from the career cell workshop.",
    "We did one round yesterday, it was awkward for five minutes and then fine.",
    "I remembered the tradeoffs on the real interview today.",
    "Apparently saying 'I tried both' is a respectable answer.",
    "saving this for the next round"
  ] },
];

const HUMAN_THREADS_C = [
  { page: 2, owner: 19, topic: "Academic", title: "chem practical starts before the coat checkout desk opens", body: "My lab coat is in the hostel and the practical is at 8:30. The equipment desk notice says 9. Is there another place to borrow one?", people: [9, 27, 19, 6, 5, 9, 19, 27, 1], comments: [
    "Department office has two spare coats in the cabinet by the lab entrance.",
    "Ask the lab assistant, they usually arrive around 8:15.",
    "Do we need to leave an ID while borrowing?",
    "They take your roll number and return it after the practical.",
    "I'll check the cabinet before my section starts.",
    "Only one spare in there this morning, size medium.",
    "I borrowed it and left my ID with the assistant.",
    "The checkout desk opened early today, someone updated the notice.",
    "coat returned, no chemicals on it"
  ] },
  { page: 3, owner: 16, topic: "Life", title: "evening run around the ground, very slow pace", body: "I'm going for one easy lap after 6. Not training for anything, just trying to get out of the library before it closes.", people: [11, 16, 23, 3, 14, 11, 16, 22, 23], comments: [
    "I'll join, my knee is fine for a gentle lap now.",
    "Can we meet at the north gate? main entrance is under construction.",
    "North gate works. I'll bring water.",
    "I'm coming from lab, might be ten minutes late.",
    "No stopwatch, right? I am not prepared for competition.",
    "No timer, just walking if the weather gets gross.",
    "North gate is locked today, meet by the tennis court instead.",
    "We did one lap and talked about food the whole time.",
    "see you next week if my assignment allows it"
  ] },
  { page: 6, owner: 14, topic: "Life", title: "orange cat asleep on the warm printer again", body: "Engineering courtyard printer is apparently a heated cat bed now. It has a clipped ear and a very confident expression. Does anyone know if it belongs to a lab?", people: [0, 10, 14, 22, 5, 0, 10, 1, 16], comments: [
    "That's Chai, the library staff feed him near the back steps.",
    "He walked into our tutorial last week and sat on someone's bag.",
    "Please don't wake him; he finally looks comfortable.",
    "I'll ask the caretaker if he has a collar or a regular spot.",
    "No collar, but he comes by the garden every afternoon.",
    "Caretaker says he's been around for years and gets checked by the vet.",
    "Printer queue is growing around the cat, nobody has the heart to move him.",
    "It started printing and he didn't even flinch.",
    "best lab assistant on campus"
  ] },
  { page: 1, owner: 18, topic: "Tech", title: "can we use the student cloud credits for a class demo", body: "Our prototype needs to stay online for review next week. The free tier says it expires in a month; are the department credits available to student teams?", people: [25, 18, 7, 26, 29, 25, 18, 2, 7], comments: [
    "Innovation cell has a form for credits, but faculty advisor has to sign it.",
    "We used the student pack last semester and it lasted through the demo.",
    "Do you need to enter a card before it grants the credits?",
    "No card for the student pack, just verify your college email.",
    "The form link in the handbook gives a 404.",
    "Try the portal under Resources, not the handbook PDF.",
    "Found it, advisor submitted the request this morning.",
    "They approved ours in two days, keep the confirmation mail.",
    "app is up, no card attached"
  ] },
  { page: 4, owner: 22, topic: "Academic", title: "reading club is picking a book for the midterm break", body: "We have two weeks free and can borrow a few copies from the library. Something not too long would be good; I will not finish a doorstopper during exam season.", people: [6, 20, 22, 14, 1, 6, 22, 29, 20], comments: [
    "The Blue Umbrella is short and the library has six copies.",
    "Could do a graphic novel this time, still counts as reading.",
    "I vote for something with chapters under twenty pages.",
    "The library's short-story shelf has a collection by Ruskin Bond.",
    "I'm in for that; can we avoid anything with a surprise exam plot.",
    "No spoilers in the poll, please. I barely know the title.",
    "Borrowed two copies already, there's a hold list for the rest.",
    "I can bring my copy from home if someone can't get one.",
    "short book it is, meeting after break"
  ] },
  { page: 5, owner: 29, topic: "Tech", title: "demo laptop won't see the campus projector", body: "Adapter works on my monitor, but the presentation screen keeps saying no signal. We have the showcase in an hour. Is there a setting on the room laptop?", people: [7, 25, 29, 18, 2, 7, 26, 29, 25], comments: [
    "Try the HDMI input button on the projector remote, it may still be on VGA.",
    "Our room had a loose cable behind the table last week.",
    "The room laptop works, my own device doesn't show up.",
    "Set display to duplicate, not extend, when you plug in.",
    "It says unsupported resolution on the screen now.",
    "Drop to 1080p at 60Hz; the old projector hates 4K.",
    "That fixed it. We kept the video backup ready anyway.",
    "The adapter was slightly loose after all, but resolution helped too.",
    "demo is showing, deep breath"
  ] },
  { page: 6, owner: 10, topic: "Life", title: "lost-and-found has three identical black chargers", body: "Someone turned in a USB-C charger near the seminar rooms. There are already two at reception, so please describe the cable or label before claiming one.", people: [5, 10, 0, 14, 22, 5, 10, 1, 0], comments: [
    "Mine has a strip of yellow tape by the plug, 65W.",
    "The one I lost is 45W and has a tiny scratch on the brick.",
    "There's a name written on mine but I won't post it here.",
    "Reception has the scratched one in a separate envelope.",
    "I think I left a blue cable attached to it, not black.",
    "This charger has a short braided cable, 65W, no tape.",
    "Yellow tape one is mine, got it from the desk.",
    "I'll put the remaining two in labeled bags so nobody mixes them.",
    "thanks for keeping the details vague"
  ] },
  { page: 7, owner: 27, topic: "Career", title: "online assessment closes at midnight in which timezone", body: "The email says 12am on the 20th but the portal counter has a different number. I don't want to find out at 11:59 that they meant another timezone.", people: [4, 27, 30, 26, 25, 4, 27, 18, 30], comments: [
    "Portal uses local time; mine says 11:59pm tonight.",
    "The email footer says IST if you expand the details.",
    "I messaged the recruiter and got confirmation it's 11:59pm IST.",
    "Is there a save-and-return option or one sitting only?",
    "One sitting, but you can pause between sections.",
    "I'll start before dinner instead of trusting the countdown.",
    "I submitted at 8 and got a receipt email straight away.",
    "Check spam; mine was under Updates.",
    "done well before midnight, lesson learned"
  ] },
  { page: 2, owner: 6, topic: "Academic", title: "does the poster session need printed copies", body: "The notice says upload a poster PDF, then lists a display board number. Are we bringing a print or will the department print them?", people: [9, 27, 6, 19, 1, 9, 6, 27, 14], comments: [
    "Department prints the uploaded version, but only if it's in by noon.",
    "Last year we had to bring our own. Did the notice change?",
    "The organizer confirmed they cover printing this time.",
    "What size should the PDF be? I only see portrait orientation.",
    "A0 portrait, template is attached to the email from Monday.",
    "Found the template, the title box is tiny for long project names.",
    "You can shrink the subtitle, keep the main title at least 36pt.",
    "I'll send my file early in case the printer queue gets weird.",
    "upload accepted, board number assigned"
  ] },
  { page: 1, owner: 25, topic: "Tech", title: "open-source workshop says bring a project but mine is tiny", body: "I only have a small script that renames lecture recordings. Is that enough to get feedback or should I find something more impressive first?", people: [7, 25, 29, 2, 18, 7, 25, 26, 29], comments: [
    "Bring the script; a small tool with a real user is a good workshop project.",
    "I submitted a calculator app last year and learned loads from the review.",
    "Could you add a dry-run option so it previews names before moving files?",
    "That would help, currently it just goes for it.",
    "Write a short README with the problem and the one thing you want feedback on.",
    "I added dry-run and a folder picker this afternoon.",
    "There's a beginner-friendly table near the entrance if you don't want a stage demo.",
    "I'll bring my project too, it barely has a README.",
    "tiny script coming with me"
  ] },
  { page: 3, owner: 11, topic: "Life", title: "playlist for the library that isn't all sad piano", body: "Need something instrumental for reading that doesn't make the afternoon feel like a movie ending. What do you put on?", people: [16, 11, 14, 23, 20, 16, 11, 22, 14], comments: [
    "I use old game soundtracks, lots of steady loops and no lyrics.",
    "Brown noise helps me more than music, surprisingly.",
    "Try the campus radio archive, they have instrumental sets from last year.",
    "I need lyrics or I start listening to the HVAC instead.",
    "There is a lofi set that doesn't have piano every thirty seconds.",
    "I made a mix of jazz guitar and rain sounds, sharing it here.",
    "That playlist got me through two chapters, bookmarking.",
    "the rain track sounds suspiciously like the lab fan",
    "good enough for focus"
  ] },
  { page: 7, owner: 30, topic: "Career", title: "internship coding test lets you choose a language, any downside to Java", body: "The role mentions Python and Java, but I'm more comfortable with Java under a timer. Will that look bad if the team uses Python?", people: [27, 30, 4, 26, 25, 27, 30, 18, 4], comments: [
    "Use the language you can explain clearly; they usually care about the solution.",
    "Check whether the platform supports Java 17, one test only had older syntax.",
    "I asked the recruiter and they said choice doesn't affect review.",
    "Do they let you run sample tests before submitting?",
    "There are three examples and a custom input box.",
    "I practiced in Java and spent more time on edge cases than syntax.",
    "I finished with six minutes left, no idea if that is good.",
    "It is better than the 30 seconds I had after compiling too late.",
    "Java it is, thanks"
  ] },
  { page: 4, owner: 1, topic: "Academic", title: "library reservation disappeared from my account", body: "I booked the study room for Friday and got the email, but the reservation isn't under my profile now. Has anyone had the same glitch?", people: [20, 1, 22, 14, 6, 20, 1, 29, 14], comments: [
    "Check the room booking tab, it isn't under regular holds.",
    "Mine vanished too after the site update, but the email was still valid.",
    "I forwarded the confirmation to the library desk just in case.",
    "Can you still cancel through the email link?",
    "Yes, the link opens the right reservation even when the account page is blank.",
    "Desk confirmed room 2B is booked under your name.",
    "They fixed the account page after I logged out and back in.",
    "Reservation has reappeared for me now.",
    "great, keeping the confirmation mail"
  ] },
  { page: 6, owner: 5, topic: "Life", title: "wallet turned in at the south canteen", body: "Found a brown wallet under the last table by the window. I handed it to the canteen manager; not posting names or cards here.", people: [0, 5, 10, 22, 14, 0, 5, 1, 10], comments: [
    "Mine is brown but I was at the north canteen this afternoon.",
    "There is an ID inside, please tell the manager to keep it in the drawer.",
    "Manager has it locked up and asked for the owner to describe the wallet.",
    "Does the south canteen stay open after the last lecture?",
    "Till 7 today, the manager is still there.",
    "Found it, it has a tiny tear on the inside pocket.",
    "That's mine, I'll bring my timetable card to confirm.",
    "Claimed successfully, owner showed the matching tear.",
    "all cards accounted for, thank you"
  ] },
  { page: 5, owner: 26, topic: "Tech", title: "final-year project board wants ideas that aren't another attendance app", body: "We have to pitch a useful campus project next week. Everyone has already suggested attendance, food ordering, and lost-and-found. What problem is still annoying you?", people: [7, 25, 26, 29, 18, 2, 7, 26, 25], comments: [
    "Room availability is always a mystery after 4pm.",
    "A map for accessible entrances and working lifts would be genuinely useful.",
    "Could track which lab machines are free, without collecting student data.",
    "Bus arrival estimates, but only if we can get reliable timing info.",
    "What about a quiet-space finder with a manual status instead of sensors?",
    "I like the lift map idea; I can help verify the routes with facilities.",
    "Let's make a list and ask students which one they'd use before coding.",
    "I can draft a quick survey that doesn't ask for names.",
    "survey first, fewer guesses"
  ] },
];

const HUMAN_THREADS = [...HUMAN_THREADS_A, ...HUMAN_THREADS_B, ...HUMAN_THREADS_C];
const STANDALONE_POSTS = [
  [0, 0, "Academic", "whiteboard marker missing from room 204", "If anyone borrowed the blue one, could you leave it at the front desk? We have a review session after lunch."],
  [1, 7, "Tech", "little script to rename lecture recordings", "Made a Python thing that adds the course code to filenames. It's ugly but saved me from opening 40 files one by one."],
  [2, 9, "Academic", "chemistry lab has extra goggles today", "They're in the clean tray near the sink. Please don't take the scratched pair with the loose arm."],
  [3, 23, "Life", "south gate is closed until five", "Security is directing people through the main entrance. The map app hasn't updated yet."],
  [7, 30, "Career", "career cell walk-ins moved to thursday", "Room 1C, not the seminar hall. Bring a printed resume if you want someone to mark it up."],
  [6, 5, "Life", "someone left a sketchbook in the shuttle", "Handed it to the driver at the main loop. The cover has a yellow sun on it."],
  [6, 6, "Academic", "selling my old calculus workbook for cheap", "Most pages are clean, a few examples have pencil notes. Can bring it to the library tomorrow."],
  [7, 26, "Career", "internship portal asks for a transcript pdf", "The download from the student portal was 18MB and the upload limit is 5. Printing to PDF brought it down."],
  [0, 14, "Academic", "study room 2b has a broken light", "Still usable near the window, but the far side is dark. I sent maintenance a note."],
  [1, 18, "Tech", "does anyone have a spare hdmi adapter", "Mine stopped working halfway through the demo. Need one for the afternoon, can return it before 6."],
  [2, 19, "Academic", "lab partner wanted for the soil sample report", "I have the measurements already, mostly need another person to check the graphs and discussion."],
  [3, 16, "Life", "walking group doing the short campus loop", "Meet by the tennis court at 6:15. No pace goals, some of us have been sitting all day."],
  [4, 20, "Academic", "short book recommendations for a long train ride", "Something I can finish in four hours without needing to keep a character chart."],
  [5, 2, "Tech", "tiny bug in the bus map fixed", "The stop labels were one index off. If you still see the old order, refresh once."],
  [6, 22, "Life", "canteen has the mango lassi back", "They only made one batch, so it may be gone by dinner."],
  [7, 4, "Career", "my first recruiter call is tomorrow morning", "It says 15 minutes and I have prepared six pages of notes. Someone tell me to close the document."],
  [0, 25, "Academic", "does the stats worksheet need a calculator", "Question 8 has decimals that are annoying by hand. The instructions don't mention tools."],
  [1, 29, "Tech", "free icon set that doesn't look like a corporate dashboard", "Found one called Tabler Icons. Clean licensing page and the outline style fits our project."],
  [2, 27, "Academic", "borrowed a spare lab coat from cabinet c", "Returned it washed and hung it on the left hook. One button is loose, sorry."],
  [3, 11, "Life", "volleyball court is free after 7", "We need two more people for a casual game. Bring water, the lights are bright."],
  [4, 13, "Academic", "reading room has new copies of the anthology", "Three copies on the lower shelf, none are checked out yet."],
  [5, 33, "Tech", "hackathon registration closes tonight", "Team name can be changed later, but the contact email cannot. Double check before submitting."],
  [6, 1, "Life", "blue scarf at the library front desk", "The librarian has it in a clear bag. No name tag that I could see."],
  [7, 27, "Career", "mock interview slots are open next week", "The signup sheet is outside the career office. Ten minutes each, bring one project to discuss."],
  [0, 6, "Academic", "borrowed notes for the economics lecture", "I missed the first half on Monday. Can return them after the tutorial tomorrow."],
  [1, 7, "Tech", "our group finally got the test suite running", "Turns out the lab machine was using node 18 and mine was on 22. Pinned the version in the project."],
  [2, 9, "Academic", "tiny chip in the beaker shelf label", "The glassware is fine, just the label is peeling. Told the technician before anyone moved things around."],
  [3, 14, "Life", "free yoga session in the courtyard on friday", "Mats are limited, but the instructor says a towel works too. Starts at 5:30."],
  [4, 22, "Academic", "found a spare copy of the library book", "It was returned early and is on the hold shelf under the course name."],
  [5, 25, "Tech", "who owns the raspberry pi kit in lab 3", "It was left on the table with no checkout slip. I put it in the equipment cabinet."],
  [6, 10, "Life", "bus pass turned in at reception", "Black card holder, no name on the outside. The desk will ask what sticker is on the back."],
  [7, 30, "Career", "resume review desk is booked solid on monday", "They added a second hour Tuesday afternoon, sign-up sheet just went up."],
  [0, 8, "Academic", "group revision for operating systems tomorrow", "We are doing processes and scheduling in the small seminar room at 3. Bring one confusing question."],
  [1, 2, "Tech", "deploy preview is working on my phone now", "Had to add the preview domain to the auth callback list. Leaving that here in case someone hits the same wall."],
  [2, 12, "Academic", "lab manual has a typo in the dilution example", "The worked answer uses 25 ml but the question says 20. I asked the instructor to confirm."],
  [3, 20, "Life", "lost one earbud somewhere near the gym", "White case, right earbud missing. If you find it, the case has a small purple sticker."],
  [4, 14, "Academic", "meeting moved to the reading room at four", "The original room is booked for a placement talk. I'll bring the book discussion questions."],
  [5, 7, "Tech", "picked up the campus api docs from the office", "Printed version is slightly outdated, the QR code points to the current page."],
  [6, 5, "Life", "found a set of keys by the engineering lawn", "Handed them to the guard at the west gate. There's a tiny wooden charm on the ring."],
  [7, 26, "Career", "which project should i lead with in an interview", "One is more polished, the other solved a problem for my hostel floor. Both are small."],
  [0, 4, "Academic", "probability tutorial is in the old lecture hall", "Room 105 today, the normal classroom is being used for a seminar."],
  [1, 25, "Tech", "shared drive has duplicate slides again", "I archived the copy with no speaker notes. Please edit the one dated 18 October."],
  [2, 21, "Academic", "borrowed microscope lens returned to the cabinet", "It's in the padded case on the top shelf, not the drawer where the old one lives."],
  [3, 24, "Life", "campus fest needs someone at the water table", "Shift is 4 to 5:30 near the main stage. They will provide the cups."],
  [4, 29, "Academic", "has anyone read the new seminar paper", "The abstract sounds useful for our discussion but the full text is behind the library login."],
  [1, 18, "Tech", "projector remote is in the top drawer now", "Room 2A's remote got moved after the workshop. Batteries are fresh."],
  [6, 28, "Life", "chai stall is open near the back gate today", "The usual cart is closed, but this one has ginger tea and takes UPI."],
  [7, 8, "Career", "company info session starts at six not five", "Calendar invite was wrong. They sent a correction to college mail around noon."],
  [0, 1, "Academic", "flashcards for anatomy chapter four", "Made a small set for the terms we keep mixing up. They are in the study group's shared folder."],
  [1, 33, "Tech", "new teammate found the missing semicolon", "It was actually a brace. The formatter is now part of the save hook and I am relieved."],
  [2, 14, "Academic", "lab timetable has saturday as a working day", "Only the morning section is meeting; the notice from last year is still pinned beside it."],
  [3, 3, "Life", "anyone want to try the new badminton nets", "They're set up near court two, but the shuttlecocks are bring-your-own."],
  [4, 25, "Academic", "course portal goes down after midnight maintenance", "Download the reading before then if you're planning a late study session."],
  [5, 10, "Tech", "found a usb drive in seminar room 1", "Gave it to security without plugging it in. They have the owner log."],
  [6, 0, "Life", "small plant cuttings available from the hostel garden", "I have three pothos cuttings in water jars. Take one before I forget to pot them."],
  [7, 13, "Career", "career fair map is finally posted", "The software companies are in the north wing, not the main atrium like last year."],
  [0, 28, "Academic", "room 204 has no whiteboard eraser", "There is chalk but no eraser. If anyone sees one in another room, bring it back later."],
  [1, 26, "Tech", "api pagination example in the docs is backwards", "The example increments the cursor before reading the current page. I filed a small issue."],
  [2, 6, "Academic", "finished the first draft of the lab discussion", "Still need to check references, but the graphs finally tell a story."],
  [3, 30, "Life", "evening stretch class moved indoors", "Rain is expected, meet in the multipurpose room instead of the courtyard."],
  [4, 22, "Academic", "library closes early on the holiday", "Returns slot stays open, but the reading rooms shut at 5."],
  [5, 2, "Tech", "bus tracker cache cleared after the route update", "The old stop order may show until your browser reloads the page."],
  [6, 32, "Life", "found a yellow tote near the shuttle stop", "It's with the driver; there is a paperback and a folded umbrella inside."],
  [7, 31, "Career", "internship application needs a faculty reference", "My advisor said to send the request at least a week before the deadline."],
  [0, 14, "Academic", "revision room open till nine tonight", "The side entrance locks earlier, so use the main library door after 7."],
  [1, 18, "Tech", "we fixed the sign-in redirect loop", "Trailing slash in the callback URL was the whole problem. Pushed a note to the repo."],
  [2, 19, "Academic", "lab groups need to label the sample tubes", "Blue tape for section A, green for section B. There are labels on the bench."],
  [3, 5, "Life", "campus shuttle is running ten minutes late", "Driver said there is a road closure near the station. Leave a little extra time."],
  [4, 20, "Academic", "short story discussion is in room 2b", "The library group has the room from four to five. Bring the anthology if you have it."],
  [5, 29, "Tech", "pair programming table open after lunch", "We will work through the API tests at 1:30. You don't need to know the whole project."],
  [6, 10, "Life", "reception has a grey hoodie from lecture hall two", "Size tag says medium. The desk has it folded behind the sign-in book."],
  [7, 4, "Career", "company talk has time for questions at the end", "I wrote down two about onboarding and one about the team's stack. Add yours if you want."],
  [0, 6, "Academic", "shared notes for the first statistics unit", "I cleaned up the probability examples and left the two questions I still can't solve at the bottom."],
  [1, 18, "Tech", "laptop loan desk has chargers again", "USB-C ones are on the second shelf, but they want your student card while you borrow one."],
  [3, 24, "Life", "main stage sound check runs until six", "The courtyard path is open, just expect a bit of noise if you're trying to study nearby."],
];

const KEYWORDS = ["laptop", "library", "hackathon", "notebook", "campus", "coffee", "study", "classroom", "coding", "books"];
const PAGE_TOPICS = [
  ["Academic", "Tech"], ["Tech", "Career"], ["Academic"], ["Life"], ["Academic", "Life"],
  ["Tech", "Career"], ["Life"], ["Career", "Academic"],
];
const PAGE_DESCRIPTIONS = [
  "Study sessions, revision swaps, and notes from people taking the same classes.",
  "A casual place to build small software projects and ask coding questions without the pressure.",
  "Lab notes, science coursework, research events, and practical questions from campus.",
  "Walks, beginner workouts, and wellness plans that fit around a student timetable.",
  "Reading together, sharing recommendations, and keeping the discussion spoiler-safe.",
  "A team space for hackathon ideas, quick prototypes, and last-minute debugging.",
  "A useful board for found items, campus notices, and things people should not have to search three buildings for.",
  "Resume reviews and placement practice for students fitting prep around classes.",
];

const hashId = (kind, key, namespace = VERSION) => {
  const hex = createHash("sha256").update(`${namespace}:${kind}:${key}`).digest("hex").slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
};

const rng = (seed) => () => {
  let value = (seed += 0x6d2b79f5);
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
};
const random = rng(4212026);
const choose = (items) => items[Math.floor(random() * items.length)];
const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const isNearDuplicate = (value, previousValues) => {
  const tokens = new Set(value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean));
  if (tokens.size < 4) return false;
  for (const previous of previousValues) {
    const other = new Set(previous.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean));
    if (other.size < 4) continue;
    let overlap = 0;
    for (const token of tokens) if (other.has(token)) overlap += 1;
    if (overlap / (tokens.size + other.size - overlap) >= 0.85) return true;
  }
  return false;
};

const activityDate = (ageDays, offset = 0) => {
  const date = new Date(Date.now() - ageDays * DAY);
  const day = date.getDay();
  const weekend = day === 0 || day === 6;
  const roll = random();
  const hour = roll < 0.07 ? (weekend ? 9 : 7) + Math.floor(random() * 3)
    : roll < 0.18 ? 12 + Math.floor(random() * 2)
      : roll < 0.67 ? (weekend ? 15 : 18) + Math.floor(random() * (weekend ? 7 : 5))
        : Math.floor(random() * 3);
  const minute = Math.floor(random() * 60);
  const second = Math.floor(random() * 60);
  const timestamp = date.setHours(hour, minute, second, 0) + offset;
  return new Date(Math.min(timestamp, Date.now() - 60_000));
};

const makePosts = (users, pages) => {
  if (HUMAN_THREADS.length < 45) throw new Error("At least 45 hand-authored threads are required.");
  if (STANDALONE_POSTS.length !== 75) throw new Error("Expected 75 hand-authored standalone posts.");
  if (HUMAN_THREADS.some((thread) => thread.comments.length < 2 || thread.comments.length > 12)) {
    throw new Error("Every hand-authored thread must have between 2 and 12 comments.");
  }
  const source = [
    ...HUMAN_THREADS.map((entry, threadIndex) => ({ ...entry, threadIndex })),
    ...STANDALONE_POSTS.map(([page, owner, topic, title, body]) => ({ page, owner, topic, title, body, threadIndex: null })),
  ];
  if (source.length !== 120) throw new Error(`Expected 120 posts, received ${source.length}.`);
  const imageKeywords = {
    Academic: ["library", "notebook", "study", "classroom"],
    Career: ["laptop", "coffee", "campus"],
    Tech: ["laptop", "hackathon", "coding"],
    Life: ["campus", "coffee", "books"],
  };
  return source.map((entry, index) => {
    const pageIndex = entry.page;
    const ownerIndex = entry.owner;
    if (!COMMUNITIES[pageIndex] || !users[ownerIndex] || !pages[pageIndex]) {
      throw new Error(`Invalid page or user reference in post ${index + 1}.`);
    }
    if (!COMMUNITIES[pageIndex][3].includes(ownerIndex)) {
      throw new Error(`Post owner ${USERS[ownerIndex][2]} is not a member of ${COMMUNITIES[pageIndex][0]}.`);
    }
    const createdAt = activityDate(2 + Math.floor(random() * 58));
    const candidates = imageKeywords[entry.topic];
    const keyword = candidates[(index + pageIndex) % candidates.length];
    const imageUrl = index % 4 === 0
      ? `https://loremflickr.com/${index % 8 === 0 ? "700/900" : "900/640"}/${keyword}?lock=${810_000 + index}`
      : null;
    return {
      _id: hashId("post", index),
      owner: users[ownerIndex]._id,
      ownerIndex,
      pageIndex,
      threadIndex: entry.threadIndex,
      title: entry.title,
      topic: entry.topic,
      description: entry.body,
      postImage: imageUrl ? [imageUrl] : [],
      postVideo: [],
      upvotes: [],
      downvotes: [],
      pages: [pages[pageIndex]._id],
      createdAt,
      updatedAt: createdAt,
    };
  });
};

const buildComments = (posts, users) => {
  const comments = [];
  for (const post of posts) {
    if (post.threadIndex === null) continue;
    const thread = HUMAN_THREADS[post.threadIndex];
    let elapsedMinutes = 4;
    const threadComments = thread.comments.map((body, index) => {
      elapsedMinutes += 7 + Math.floor(random() * 53);
      const parentIndex = index === 5 || index === 7 ? index - 1 : null;
      return {
        _id: hashId(parentIndex === null ? "comment" : "reply", `${post._id}:${index}`),
        post: post._id,
        parentComment: parentIndex === null ? null : hashId(
          parentIndex === 5 || parentIndex === 7 ? "reply" : "comment",
          `${post._id}:${parentIndex}`,
        ),
        author: users[thread.people[index]]._id,
        body,
        upvotes: [],
        status: "none",
        createdAt: new Date(post.createdAt.getTime() + elapsedMinutes * 60_000),
        updatedAt: new Date(post.createdAt.getTime() + elapsedMinutes * 60_000),
        threadIndex: post.threadIndex,
      };
    });
    comments.push(...threadComments);
  }
  if (comments.length < 400) {
    throw new Error(`The hand-authored threads produced only ${comments.length} comments; at least 400 are required.`);
  }
  return comments;
};
const ask = async (prompt) => {
  const readline = createInterface({ input: stdin, output: stdout });
  try {
    return (await readline.question(prompt)).trim();
  } finally {
    readline.close();
  }
};

const assertUniqueSeedContent = (posts, comments = []) => {
  const normalize = (text) => text.toLowerCase().replace(/\s+/g, " ").trim();
  if (new Set(posts.map((post) => normalize(post.title))).size !== posts.length) {
    throw new Error("Duplicate post title detected; no further seed writes were attempted.");
  }
  if (new Set(posts.map((post) => normalize(post.description))).size !== posts.length) {
    throw new Error("Duplicate post body detected; no further seed writes were attempted.");
  }
  if (new Set(comments.map((comment) => normalize(comment.body))).size !== comments.length) {
    throw new Error("Duplicate comment detected; no further seed writes were attempted.");
  }
  const imageUrls = posts.flatMap((post) => post.postImage);
  if (new Set(imageUrls).size !== imageUrls.length) {
    throw new Error("Duplicate post image URL detected; no further seed writes were attempted.");
  }
  const avatarUrls = USERS.map((user, index) => index % 11 === 10 ? "" : `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(user[0])}`);
  const assignedAvatars = avatarUrls.filter(Boolean);
  if (new Set(assignedAvatars).size !== assignedAvatars.length) {
    throw new Error("Duplicate avatar URL detected; no further seed writes were attempted.");
  }
  return { duplicateImages: imageUrls.length - new Set(imageUrls).size, imageCount: imageUrls.length };
};

const assertNoNearDuplicates = (values, label) => {
  const verified = [];
  for (const [index, value] of values.entries()) {
    if (isNearDuplicate(value, verified)) {
      throw new Error(`Near-duplicate ${label} text detected at entry ${index + 1}.`);
    }
    verified.push(value);
  }
};

const validateFixture = () => {
  const fakeUsers = USERS.map(() => ({ _id: new mongoose.Types.ObjectId() }));
  const fakePages = COMMUNITIES.map(() => ({ _id: new mongoose.Types.ObjectId() }));
  const posts = makePosts(fakeUsers, fakePages);
  const comments = buildComments(posts, fakeUsers);
  assertUniqueSeedContent(posts, comments);
  assertNoNearDuplicates(posts.map((post) => `${post.title} ${post.description}`), "post");
  assertNoNearDuplicates(comments.map((comment) => comment.body), "comment");

  for (const post of posts) {
    const { _id, ownerIndex, pageIndex, threadIndex, ...fields } = post;
    const validationError = new Post(fields).validateSync();
    if (validationError) throw validationError;
  }
  for (const comment of comments) {
    const { threadIndex, ...fields } = comment;
    const validationError = new Comment(fields).validateSync();
    if (validationError) throw validationError;
  }
  console.log(`Fixture validation passed: ${posts.length} posts, ${comments.length} comments, ${HUMAN_THREADS.length} hand-authored threads, ${posts.filter((post) => post.postImage.length).length} unique post images.`);
};

const main = async () => {
  if (process.argv.includes("--validate")) {
    validateFixture();
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Seed scripts are disabled in production.");
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured.");
  await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
  console.log(`Connected database: ${mongoose.connection.name}`);
  if (mongoose.connection.name !== DB_NAME) throw new Error(`Refusing to seed unexpected database "${mongoose.connection.name}".`);
  if ((await ask("Confirm this is your development database, not production. Type YES to seed: ")) !== "YES") {
    console.log("Seed cancelled; no records inserted.");
    return;
  }

  const users = [];
  const avatarUrls = USERS.map((user, index) => index % 11 === 10 ? "" : `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(user[0])}`);
  if (new Set(avatarUrls.filter(Boolean)).size !== avatarUrls.filter(Boolean).length) throw new Error("Duplicate avatar URL detected.");
  for (const [index, [name, email, username, bio]] of USERS.entries()) {
    const _id = hashId("user", index);
    const existing = await User.findOne({ $or: [{ _id }, { email }] });
    if (existing) {
      users.push(existing);
      continue;
    }
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const user = await User.create({
      _id,
      username,
      email,
      password: passwordHash,
      title: index < 10 ? "Contributor" : "Newcomer",
      point: index < 10 ? 120 : index % 5 === 0 ? 60 : 0,
      profileImage: avatarUrls[index],
      bio,
      badges: [],
      followers: [],
      following: [],
      savedPost: [],
      refreshToken: [],
      passwordResetVersion: 0,
      createdAt: activityDate(58 - index),
    });
    users.push(user);
  }

  const pages = [];
  const pageIds = [];
  for (const [index, [pageName, ownerIndex, type, memberIndices]] of COMMUNITIES.entries()) {
    const _id = hashId("page", index);
    const page = await Page.create({
      _id,
      pageName,
      owner: users[ownerIndex]._id,
      pageDescription: PAGE_DESCRIPTIONS[index],
      moderators: [users[ownerIndex]._id],
      title: PAGE_TOPICS[index],
      pageProfileImage: `https://loremflickr.com/1200/500/${KEYWORDS[index % KEYWORDS.length]}?lock=${910_000 + index}`,
      members: [...new Set([ownerIndex, ...memberIndices])].map((memberIndex) => users[memberIndex]._id),
      type,
      createdAt: activityDate(54 - index * 3),
    });
    pages.push(page);
    pageIds.push(page._id);
  }

  const posts = makePosts(users, pages);
  const comments = buildComments(posts, users);
  const uniqueness = assertUniqueSeedContent(posts, comments);
  assertNoNearDuplicates(posts.map((post) => `${post.title} ${post.description}`), "post");
  assertNoNearDuplicates(comments.map((comment) => comment.body), "comment");
  for (const [index, post] of posts.entries()) {
    const voterPool = shuffle(users.filter((user) => !user._id.equals(post.owner)));
    const voteCount = [18, 73, 109, 115].includes(index) ? 31 + Math.floor(random() * 4) : index === 118 ? 34 : Math.floor(random() * 7);
    post.upvotes = voterPool.slice(0, voteCount).map((user) => user._id);
    await Post.create(post);
  }

  for (const comment of comments) await Comment.create(comment);

  const requestSpecs = [
    [4, 10, "pending", "Hey, could I join the next discussion?"],
    [4, 11, "approved", "I can bring the book from the library."],
    [7, 12, "rejected", "Would like to join the placement prep group."],
  ];
  const requests = [];
  for (const [index, [pageIndex, userIndex, status, message]] of requestSpecs.entries()) {
    const request = await JoinRequest.create({
      _id: hashId("join-request", index),
      page: pages[pageIndex]._id,
      requestedBy: users[userIndex]._id,
      status,
      message,
    });
    requests.push(request);
  }
  await Page.updateOne(
    { _id: pages[4]._id },
    { $addToSet: { members: users[11]._id } },
  );

  const notifications = [];
  const addNotification = async (key, recipient, sender, type, fields = {}) => {
    const notification = await Notification.create({
      _id: hashId("notification", key),
      recipient,
      sender,
      type,
      message: fields.message || null,
      post: fields.post || null,
      comment: fields.comment || null,
      page: fields.page || null,
      isRead: false,
    });
    notifications.push(notification);
  };
  for (const [index, post] of posts.entries()) {
    if (index % 5 !== 0) continue;
    const voterId = post.upvotes[0];
    if (!voterId) continue;
    await addNotification(`vote:${index}`, post.owner, voterId, "post_upvote", { post: post._id });
  }
  for (const [index, comment] of comments.entries()) {
    if (index % 18 !== 0) continue;
    const post = posts.find((candidate) => candidate._id.equals(comment.post));
    if (post && !post.owner.equals(comment.author)) {
      await addNotification(`comment:${index}`, post.owner, comment.author, "comment", {
        post: post._id,
        comment: comment._id,
      });
    }
  }
  for (const [index, [pageIndex, userIndex, status]] of requestSpecs.entries()) {
    const pending = status === "pending";
    const owner = users[COMMUNITIES[pageIndex][1]];
    const applicant = users[userIndex];
    await addNotification(
      `request:${index}`,
      pending ? owner._id : applicant._id,
      pending ? applicant._id : owner._id,
      status === "pending" ? "join_request" : status === "approved" ? "request_approved" : "request_rejected",
      { page: pages[pageIndex]._id },
    );
  }

  const seededUsers = [...new Map(users.map((user) => [String(user._id), user])).values()];
  console.log("\nSeeded document counts:");
  console.table([
    { collection: "users", count: await User.countDocuments({ _id: { $in: seededUsers.map((user) => user._id) } }) },
    { collection: "pages", count: await Page.countDocuments({ _id: { $in: pageIds } }) },
    { collection: "posts", count: await Post.countDocuments({ _id: { $in: posts.map((post) => post._id) } }) },
    { collection: "comments", count: await Comment.countDocuments({ _id: { $in: comments.map((comment) => comment._id) } }) },
    { collection: "joinrequests", count: await JoinRequest.countDocuments({ _id: { $in: requests.map((request) => request._id) } }) },
    { collection: "notifications", count: await Notification.countDocuments({ _id: { $in: notifications.map((notification) => notification._id) } }) },
    { collection: "otps", count: 0 },
  ]);
  console.log(`Post images: ${uniqueness.imageCount}; duplicate image URLs: ${uniqueness.duplicateImages}.`);
  console.log("The User schema has no verified/onboarded fields; seed users are directly login-ready and no OTPs are required.");
  console.log("\n10 random complete threads:");
  for (const post of shuffle(posts.filter((item) => item.threadIndex !== null)).slice(0, 10)) {
    const thread = HUMAN_THREADS[post.threadIndex];
    console.log(`\n${post.title}\n${post.description}`);
    thread.comments.forEach((body, index) => {
      console.log(`  ${USERS[thread.people[index]][2]}: ${body}`);
    });
  }
  console.log("\nSeed users can sign in with their username. Passwords were hashed; credentials were not printed.");
};

main()
  .catch((error) => {
    const rawMessage = String(error?.message || error);
    const message = process.env.MONGODB_URI ? rawMessage.replaceAll(process.env.MONGODB_URI, "[redacted]") : rawMessage;
    console.error(`Seed failed (${error?.name || "Error"}): ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
