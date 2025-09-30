"use client"

import { useState } from "react"
import { Sparkles, Loader2, Download } from "lucide-react"

interface ScheduleData {
  [day: string]: {
    [time: string]: string
  }
}

interface CalendarEvent {
  id: number
  title: string
  startTime: string
  endTime: string
  color: string
  day: number
  description: string
  location: string
  attendees: string[]
  organizer: string
}

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
const times = [
  "07:30 - 08:30",
  "08:30 - 09:30",
  "09:30 - 10:30",
  "10:30 - 11:30",
  "11:30 - 12:30",
  "12:30 - 13:30",
  "13:30 - 14:30",
  "14:30 - 15:30",
  "15:30 - 16:30",
]

export default function AIStudyScheduler({
  onClose,
  onScheduleGenerated
}: {
  onClose: () => void
  onScheduleGenerated?: (events: CalendarEvent[]) => void
}) {
  const [classTimes, setClassTimes] = useState("")
  const [studyGoals, setStudyGoals] = useState("")
  const [schedule, setSchedule] = useState<ScheduleData | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const convertToCalendarEvents = (scheduleData: ScheduleData): CalendarEvent[] => {
    const events: CalendarEvent[] = []
    let eventId = 1000 // Start from 1000 to avoid conflicts with existing events

    const colors = [
      "bg-blue-400",
      "bg-purple-400",
      "bg-green-400",
      "bg-pink-400",
      "bg-yellow-400",
      "bg-indigo-400",
      "bg-teal-400",
      "bg-orange-400"
    ]

    days.forEach((dayName, dayIndex) => {
      const daySchedule = scheduleData[dayName]
      if (daySchedule) {
        times.forEach((timeSlot) => {
          const task = daySchedule[timeSlot]
          if (task && task.trim() !== "" && task !== "-") {
            const [startTime, endTime] = timeSlot.split(" - ")
            events.push({
              id: eventId++,
              title: task,
              startTime,
              endTime,
              color: colors[eventId % colors.length],
              day: dayIndex + 1, // 1 = Monday, 2 = Tuesday, etc.
              description: "AI Generated Study Task",
              location: "Study Session",
              attendees: ["You"],
              organizer: "AI Study Planner"
            })
          }
        })
      }
    })

    return events
  }

  const handleSubmit = async () => {
    setError("")
    setSchedule(null)
    setLoading(true)

    try {
      const res = await fetch("http://localhost:3000/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          classTimes: classTimes.split("\n").map((line) => line.trim()).filter(Boolean),
          studyGoals,
        }),
      })

      if (!res.ok) {
        throw new Error("Failed to generate schedule")
      }

      const data = await res.json()
      setSchedule(data)
    } catch (err) {
      console.error("❌ Error fetching schedule:", err)
      setError("Error generating schedule. Make sure the backend server is running on port 3000.")
    } finally {
      setLoading(false)
    }
  }

  const downloadPDF = () => {
    if (!schedule) return

    // Create HTML content for the schedule
    let htmlContent = `
      <html>
        <head>
          <title>Study Schedule</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; text-align: center; }
            table { border-collapse: collapse; width: 100%; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: center; }
            th { background-color: #f2f2f2; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .empty { color: #ccc; }
          </style>
        </head>
        <body>
          <h1>📅 AI Study Schedule</h1>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                ${days.map(day => `<th>${day}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${times.map(time => `
                <tr>
                  <td>${time}</td>
                  ${days.map(day => {
                    const task = schedule[day] && schedule[day][time] ? schedule[day][time] : ''
                    return `<td${!task ? ' class="empty"' : ''}>${task || '-'}</td>`
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `

    // Create a blob and download
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'study-schedule.html'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-purple-600 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-white" />
              <h2 className="text-2xl font-bold text-white">AI Study Scheduler</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-all duration-300 hover:scale-110"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Class Times (one per line)
              </label>
              <textarea
                value={classTimes}
                onChange={(e) => setClassTimes(e.target.value)}
                rows={6}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                placeholder="Example:&#10;Mon 10:30 - 11:30&#10;Wed 14:00 - 15:00&#10;Fri 09:00 - 10:00"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Study Goals (comma separated)
              </label>
              <textarea
                value={studyGoals}
                onChange={(e) => setStudyGoals(e.target.value)}
                rows={6}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                placeholder="Example:&#10;Finish math homework, Read history chapter, Practice coding"
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generate Schedule
              </>
            )}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {schedule && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">Generated Schedule</h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      if (schedule && onScheduleGenerated) {
                        const calendarEvents = convertToCalendarEvents(schedule)
                        onScheduleGenerated(calendarEvents)
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-300 hover:scale-105 hover:shadow-lg"
                  >
                    <Sparkles className="h-4 w-4" />
                    Add to Calendar
                  </button>
                  <button
                    onClick={downloadPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all duration-300 hover:scale-105 hover:shadow-lg"
                  >
                    <Download className="h-4 w-4" />
                    Download HTML
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-lg">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-500 to-purple-600">
                      <th className="p-3 text-white font-semibold border border-white/20">Time</th>
                      {days.map((day) => (
                        <th key={day} className="p-3 text-white font-semibold border border-white/20">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {times.map((time, idx) => (
                      <tr key={time} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                        <td className="p-3 font-medium text-gray-700 border border-gray-200">{time}</td>
                        {days.map((day) => (
                          <td
                            key={day + time}
                            className="p-3 text-sm text-gray-600 border border-gray-200"
                          >
                            {schedule[day] && schedule[day][time]
                              ? schedule[day][time]
                              : "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
