```mermaid
usecaseDiagram
    actor Student
    actor Teacher
    actor Admin

    package "Vidya Setu Platform" {
        usecase "Login (OTP / School ID)" as UC1
        usecase "View Available Lessons" as UC2
        usecase "Watch Video Content" as UC3
        usecase "Take Quizzes" as UC4
        usecase "Download Lessons for Offline" as UC5
        
        usecase "Create / Upload Lessons" as UC6
        usecase "Create Quizzes" as UC7
        usecase "View Class Analytics" as UC8
        usecase "Send Announcements" as UC9
        
        usecase "Manage Users & Schools" as UC10
        usecase "View Platform Analytics" as UC11
        usecase "Reset Passwords" as UC12
        
        usecase "Sync Offline Progress" as UC13
        usecase "Real-time Chat" as UC14
    }

    Student --> UC1
    Student --> UC2
    Student --> UC3
    Student --> UC4
    Student --> UC5
    Student --> UC13
    Student --> UC14

    Teacher --> UC1
    Teacher --> UC6
    Teacher --> UC7
    Teacher --> UC8
    Teacher --> UC9
    Teacher --> UC14

    Admin --> UC1
    Admin --> UC10
    Admin --> UC11
    Admin --> UC12

    UC3 ..> UC13 : <<includes>>
    UC4 ..> UC13 : <<includes>>
```
