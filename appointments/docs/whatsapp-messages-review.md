# All WhatsApp messages sent from book.vocalzz.com (for review)

Updated 24 Nov 2026. Example names, dates and times are made up; the app fills in the real ones.
Messages 1–16 go out **automatically** once the WhatsApp API number is connected (until then they wait on the
**Messages** page with a one-tap "Send on WhatsApp" button). Messages 17–18 are **sent by you** with a button.
Patient messages go only to patients with WhatsApp consent ticked.

Note: each automatic message is a Meta "template". Changing wording later means resubmitting that template to Meta
for approval (usually minutes), so it's best to finalise the wording now, before the API setup.

## To parents / patients

### 1. Booking confirmation
**Sent to:** Parent / patient · **Template name:** `vocalzz_appt_confirmed`

> Hello Mrs. Sharma, the Speech therapy session for Aarav with Dr. Samriddhi at Vocalzz Speech & Audio is confirmed for Fri, 27 Nov 2026, 5:00 PM.
> 
> Address: Tower E-004, Logix Blossom County, Sector 137, Noida 201304.
> To cancel or change the time, please WhatsApp us on +91 99106 71188.

### 2. Consultation booked (new patient)
**Sent to:** Parent / patient · **Template name:** `vocalzz_consult_confirmed`

> Hello Mrs. Sharma, the first consultation for Aarav with Dr. Tanu Garg at Vocalzz Speech & Audio is booked for Fri, 27 Nov 2026, 11:00 AM. It takes about 30 minutes.
> 
> In this visit we listen to your concerns, observe, and suggest a plan. Please bring any earlier reports.
> 
> Address: Tower E-004, Logix Blossom County, Sector 137, Noida 201304.
> To cancel or change the time, please WhatsApp us on +91 99106 71188.

### 3. Reminder: day before (~24 h)
**Sent to:** Parent / patient · **Template name:** `vocalzz_appt_reminder`

> Hello Mrs. Sharma, a reminder that the Speech therapy session for Aarav with Dr. Samriddhi at Vocalzz Speech & Audio is tomorrow, Fri, 27 Nov 2026, 5:00 PM.
> 
> To cancel or change the time, please WhatsApp us on +91 99106 71188.

### 4. Reminder: same day (~2 h before)
**Sent to:** Parent / patient · **Template name:** `vocalzz_appt_reminder`

> Hello Mrs. Sharma, a reminder that the Speech therapy session for Aarav with Dr. Samriddhi at Vocalzz Speech & Audio is today at 5:00 PM.
> 
> To cancel or change the time, please WhatsApp us on +91 99106 71188.

### 5. Session moved (new time)
**Sent to:** Parent / patient · **Template name:** `vocalzz_appt_rescheduled`

> Hello Mrs. Sharma, the Speech therapy session for Aarav with Dr. Samriddhi at Vocalzz Speech & Audio has been moved to Sat, 28 Nov 2026, 4:00 PM.
> 
> To cancel or change the time, please WhatsApp us on +91 99106 71188.

### 6. Session cancelled
**Sent to:** Parent / patient · **Template name:** `vocalzz_appt_cancelled`

> Hello Mrs. Sharma, the Speech therapy session for Aarav on Fri, 27 Nov 2026, 5:00 PM at Vocalzz Speech & Audio has been cancelled.
> 
> To book a new time, please WhatsApp us on +91 99106 71188.

### 7. Weekly sessions booked
**Sent to:** Parent / patient · **Template name:** `vocalzz_series_confirmed`

> Hello Mrs. Sharma, the weekly Speech therapy sessions for Aarav with Dr. Samriddhi at Vocalzz Speech & Audio are booked for 5:00 PM on these dates: Mon 30 Nov, Mon 7 Dec, Mon 14 Dec.
> 
> Address: Tower E-004, Logix Blossom County, Sector 137, Noida 201304.
> To cancel or change a session, please WhatsApp us on +91 99106 71188.

### 8. Weekly sessions moved
**Sent to:** Parent / patient · **Template name:** `vocalzz_series_moved`

> Hello Mrs. Sharma, the weekly Speech therapy sessions for Aarav at Vocalzz Speech & Audio have new times. They are now with Dr. Samriddhi on: Tue 1 Dec 4:00 PM, Tue 8 Dec 4:00 PM.
> 
> To cancel or change a session, please WhatsApp us on +91 99106 71188.

### 9. Weekly sessions cancelled
**Sent to:** Parent / patient · **Template name:** `vocalzz_series_cancelled`

> Hello Mrs. Sharma, these Speech therapy sessions for Aarav at Vocalzz Speech & Audio have been cancelled: Mon 7 Dec, Mon 14 Dec.
> 
> To book new times, please WhatsApp us on +91 99106 71188.

## To therapists

### 10. New appointment
**Sent to:** Therapist · **Template name:** `vocalzz_therapist_new`

> New appointment for you: Aarav (Speech therapy) on Fri, 27 Nov 2026, 5:00 PM, for 40 minutes. Please check the schedule for details.

### 11. New consultation
**Sent to:** Therapist · **Template name:** `vocalzz_therapist_consult`

> New consultation for you: Aarav, a new patient, on Fri, 27 Nov 2026, 11:00 AM for 30 minutes. Parent or contact: Mrs. Sharma, +91 98XXX XXXXX. Please check the schedule for details.

### 12. Appointment moved
**Sent to:** Therapist · **Template name:** `vocalzz_therapist_moved`

> Appointment moved: Aarav (Speech therapy) is now on Sat, 28 Nov 2026, 4:00 PM, for 40 minutes. It was on Fri, 27 Nov 2026, 5:00 PM before. Please check the schedule.

### 13. Appointment cancelled
**Sent to:** Therapist · **Template name:** `vocalzz_therapist_cancelled`

> Appointment cancelled: Aarav (Speech therapy) on Fri, 27 Nov 2026, 5:00 PM will not take place. Please check the schedule.

### 14. New weekly sessions
**Sent to:** Therapist · **Template name:** `vocalzz_therapist_series`

> New weekly sessions for you: Aarav (Speech therapy) at 5:00 PM on Mon 30 Nov, Mon 7 Dec, Mon 14 Dec. Please check the schedule for details.

### 15. Weekly sessions updated
**Sent to:** Therapist · **Template name:** `vocalzz_therapist_series_moved`

> Weekly sessions updated: Aarav (Speech therapy) is now with you on Tue 1 Dec 4:00 PM, Tue 8 Dec 4:00 PM. Please check the schedule.

### 16. Sessions cancelled
**Sent to:** Therapist · **Template name:** `vocalzz_therapist_series_cancelled`

> Sessions cancelled: Aarav (Speech therapy) on Mon 7 Dec, Mon 14 Dec. Please check the schedule.

## Sent by you (one-tap button, opens WhatsApp with the text ready to edit)

### 17. Missed sessions check-in
**Where:** Patient history page, when a patient has missed 2 sessions in a row.

> Hello Mrs. Sharma, we missed Aarav at the last couple of sessions at Vocalzz. We hope everything is okay. Would you like us to find a time that suits you better? Just reply to this message.

### 18. Monthly session summary
**Where:** Patient history page → "Share this summary".

> Hello Mrs. Sharma, here is Aarav's session summary at Vocalzz for November 2026: 8 attended, 1 missed, 0 cancelled, 2 still to come. Thank you for being part of the therapy journey. For any questions, just reply to this message.

## Timing of automatic messages
| Event | When it goes out |
|---|---|
| Booking / consultation / weekly booking / move / cancel | Immediately, when saved in the app |
| Day-before reminder | About 24 hours before the session |
| Same-day reminder | About 2 hours before the session |
