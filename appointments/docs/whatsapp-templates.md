# WhatsApp message templates

Create each template in **WhatsApp Manager → Message templates → Create template** with:

- **Category:** Utility
- **Language:** English
- **Name:** exactly as shown, because the code refers to these names
- **Body:** copy the text exactly, including the {{1}}, {{2}}… placeholders
- **Sample values:** Meta asks for an example of each placeholder. Use the samples below.

This file is generated from `src/whatsapp.ts`. If you change wording there, update the template in WhatsApp
Manager too, and wait for it to be approved again.

## vocalzz_appt_confirmed

```
Hello {{1}}, the {{2}} session for {{3}} with {{4}} at Vocalzz Speech & Audio is confirmed for {{5}}.

Address: Tower E-004, Logix Blossom County, Sector 137, Noida 201304.
To cancel or change the time, just reply to this message.
```

Sample values:

- {{1}}: Priya
- {{2}}: Speech therapy
- {{3}}: Aarav
- {{4}}: Dr. Samriddhi
- {{5}}: Fri, 20 Nov 2026, 5:00 PM

## vocalzz_appt_reminder

```
Hello {{1}}, a reminder that the {{2}} session for {{3}} with {{4}} at Vocalzz Speech & Audio is {{5}}.

To cancel or change the time, just reply to this message.
```

Sample values:

- {{1}}: Priya
- {{2}}: Speech therapy
- {{3}}: Aarav
- {{4}}: Dr. Samriddhi
- {{5}}: tomorrow, Fri, 20 Nov 2026, 5:00 PM

## vocalzz_appt_rescheduled

```
Hello {{1}}, the {{2}} session for {{3}} with {{4}} at Vocalzz Speech & Audio has been moved to {{5}}.

To cancel or change the time, just reply to this message.
```

Sample values:

- {{1}}: Priya
- {{2}}: Speech therapy
- {{3}}: Aarav
- {{4}}: Dr. Samriddhi
- {{5}}: Sat, 21 Nov 2026, 4:00 PM

## vocalzz_appt_cancelled

```
Hello {{1}}, the {{2}} session for {{3}} on {{4}} at Vocalzz Speech & Audio has been cancelled.

To book a new time, just reply to this message.
```

Sample values:

- {{1}}: Priya
- {{2}}: Speech therapy
- {{3}}: Aarav
- {{4}}: Fri, 20 Nov 2026, 5:00 PM

## vocalzz_therapist_new

```
New appointment for you: {{1}} ({{2}}) on {{3}}, for {{4}} minutes. Please check the schedule for details.
```

Sample values:

- {{1}}: Aarav
- {{2}}: Speech therapy
- {{3}}: Fri, 20 Nov 2026, 5:00 PM
- {{4}}: 45

## vocalzz_therapist_moved

```
Appointment moved: {{1}} ({{2}}) is now on {{3}}, for {{4}} minutes. It was on {{5}} before. Please check the schedule.
```

Sample values:

- {{1}}: Aarav
- {{2}}: Speech therapy
- {{3}}: Sat, 21 Nov 2026, 4:00 PM
- {{4}}: 45
- {{5}}: Fri, 20 Nov 2026, 5:00 PM

## vocalzz_therapist_cancelled

```
Appointment cancelled: {{1}} ({{2}}) on {{3}} will not take place. Please check the schedule.
```

Sample values:

- {{1}}: Aarav
- {{2}}: Speech therapy
- {{3}}: Fri, 20 Nov 2026, 5:00 PM

## vocalzz_series_confirmed

```
Hello {{1}}, the weekly {{2}} sessions for {{3}} with {{4}} at Vocalzz Speech & Audio are booked for {{5}} on these dates: {{6}}.

Address: Tower E-004, Logix Blossom County, Sector 137, Noida 201304.
To cancel or change a session, just reply to this message.
```

Sample values:

- {{1}}: Priya
- {{2}}: Speech therapy
- {{3}}: Aarav
- {{4}}: Dr. Samriddhi
- {{5}}: 5:00 PM
- {{6}}: Mon 16 Nov, Thu 19 Nov, Mon 23 Nov, Thu 26 Nov

## vocalzz_therapist_series

```
New weekly sessions for you: {{1}} ({{2}}) at {{3}} on {{4}}. Please check the schedule for details.
```

Sample values:

- {{1}}: Aarav
- {{2}}: Speech therapy
- {{3}}: 5:00 PM
- {{4}}: Mon 16 Nov, Thu 19 Nov, Mon 23 Nov

## vocalzz_series_cancelled

```
Hello {{1}}, these {{2}} sessions for {{3}} at Vocalzz Speech & Audio have been cancelled: {{4}}.

To book new times, just reply to this message.
```

Sample values:

- {{1}}: Priya
- {{2}}: Speech therapy
- {{3}}: Aarav
- {{4}}: Mon 23 Nov, Thu 26 Nov

## vocalzz_therapist_series_cancelled

```
Sessions cancelled: {{1}} ({{2}}) on {{3}}. Please check the schedule.
```

Sample values:

- {{1}}: Aarav
- {{2}}: Speech therapy
- {{3}}: Mon 23 Nov, Thu 26 Nov

## vocalzz_series_moved

```
Hello {{1}}, the weekly {{2}} sessions for {{3}} at Vocalzz Speech & Audio have new times. They are now with {{4}} on: {{5}}.

To cancel or change a session, just reply to this message.
```

Sample values:

- {{1}}: Priya
- {{2}}: Speech therapy
- {{3}}: Aarav
- {{4}}: Dr. Samriddhi
- {{5}}: Mon 7 Dec 4:00 PM, Mon 14 Dec 4:00 PM, Mon 21 Dec 4:00 PM

## vocalzz_therapist_series_moved

```
Weekly sessions updated: {{1}} ({{2}}) is now with you on {{3}}. Please check the schedule.
```

Sample values:

- {{1}}: Aarav
- {{2}}: Speech therapy
- {{3}}: Mon 7 Dec 4:00 PM, Mon 14 Dec 4:00 PM
