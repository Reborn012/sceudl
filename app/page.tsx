"use client"

import { useState, useEffect } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  Search,
  Settings,
  Menu,
  Clock,
  MapPin,
  Users,
  Calendar,
  Pause,
  Sparkles,
  X,
  Moon,
  Sun,
} from "lucide-react"

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [showAIPopup, setShowAIPopup] = useState(false)
  const [typedText, setTypedText] = useState("")
  const [isPlaying, setIsPlaying] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [currentView, setCurrentView] = useState("week")
  const [currentMonth, setCurrentMonth] = useState("March 2025")
  const [selectedDay, setSelectedDay] = useState(5)
  const [currentDate, setCurrentDate] = useState("March 5")
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [draggedEvent, setDraggedEvent] = useState(null)
  const [dragOverDay, setDragOverDay] = useState(null)
  const [showSchedulePopup, setShowSchedulePopup] = useState(false)
  const [scheduleInput, setScheduleInput] = useState("")
  const [studyGoals, setStudyGoals] = useState("")
  const [uploadedFileName, setUploadedFileName] = useState("")

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDarkMode])

  useEffect(() => {
    if (showAIPopup) {
      const text =
        "Welcome to SCEUDL! Upload your class schedule PDF and I'll help you create an optimized study plan based on your goals."
      let i = 0
      const typingInterval = setInterval(() => {
        if (i < text.length) {
          setTypedText((prev) => prev + text.charAt(i))
          i++
        } else {
          clearInterval(typingInterval)
        }
      }, 50)

      return () => clearInterval(typingInterval)
    }
  }, [showAIPopup])

  const [events, setEvents] = useState([])

  const getEventClasses = (color) => {
    const colorMap = {
      cyan: "bg-cyan-50 dark:bg-cyan-950/30 border-l-4 border-l-cyan-500 text-cyan-700 dark:text-cyan-300",
      blue: "bg-blue-50 dark:bg-blue-950/30 border-l-4 border-l-blue-500 text-blue-700 dark:text-blue-300",
      green: "bg-green-50 dark:bg-green-950/30 border-l-4 border-l-green-500 text-green-700 dark:text-green-300",
      purple: "bg-purple-50 dark:bg-purple-950/30 border-l-4 border-l-purple-500 text-purple-700 dark:text-purple-300",
      orange: "bg-orange-50 dark:bg-orange-950/30 border-l-4 border-l-orange-500 text-orange-700 dark:text-orange-300",
      pink: "bg-pink-50 dark:bg-pink-950/30 border-l-4 border-l-pink-500 text-pink-700 dark:text-pink-300",
      indigo: "bg-indigo-50 dark:bg-indigo-950/30 border-l-4 border-l-indigo-500 text-indigo-700 dark:text-indigo-300",
      teal: "bg-teal-50 dark:bg-teal-950/30 border-l-4 border-l-teal-500 text-teal-700 dark:text-teal-300",
      red: "bg-red-50 dark:bg-red-950/30 border-l-4 border-l-red-500 text-red-700 dark:text-red-300",
      yellow: "bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-l-yellow-500 text-yellow-700 dark:text-yellow-300",
    }
    return colorMap[color] || colorMap.cyan
  }

  const weekDays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
  const weekDates = [3, 4, 5, 6, 7, 8, 9]
  const timeSlots = Array.from({ length: 24 }, (_, i) => i)

  const calculateEventStyle = (startTime, endTime) => {
    const start = Number.parseInt(startTime.split(":")[0]) + Number.parseInt(startTime.split(":")[1]) / 60
    const end = Number.parseInt(endTime.split(":")[0]) + Number.parseInt(endTime.split(":")[1]) / 60
    const top = start * 80
    const height = (end - start) * 80
    return { top: `${top}px`, height: `${height}px` }
  }

  const daysInMonth = 31
  const firstDayOffset = 5
  const miniCalendarDays = Array.from({ length: daysInMonth + firstDayOffset }, (_, i) =>
    i < firstDayOffset ? null : i - firstDayOffset + 1,
  )

  const myCalendars = [
    { name: "My Calendar", color: "bg-blue-500" },
    { name: "Work", color: "bg-green-500" },
    { name: "Personal", color: "bg-purple-500" },
    { name: "Family", color: "bg-orange-500" },
  ]

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }

  const getSelectedDayIndex = () => {
    return weekDates.indexOf(selectedDay) + 1
  }

  const handleEventClick = (event) => {
    setSelectedEvent(event)
  }

  const handlePDFUpload = async (event) => {
    const file = event.target.files?.[0]
    if (file && file.type === "application/pdf") {
      setUploadedFileName(file.name)

      // Upload PDF to backend
      const formData = new FormData()
      formData.append("pdf", file)

      try {
        const response = await fetch("http://localhost:3001/upload-pdf", {
          method: "POST",
          body: formData,
        })

        if (response.ok) {
          const data = await response.json()
          console.log("PDF Upload Response:", data)
          // Auto-fill the class times from the parsed PDF
          if (data.schedule && data.schedule.classTimes) {
            setScheduleInput(data.schedule.classTimes.join("\n"))
          } else if (data.classTimes) {
            // Backend returns classTimes directly
            setScheduleInput(data.classTimes.join("\n"))
          }
          setShowSchedulePopup(true)
        } else {
          console.error("Failed to upload PDF")
          setShowSchedulePopup(true)
          setScheduleInput("")
        }
      } catch (error) {
        console.error("Error uploading PDF:", error)
        setShowSchedulePopup(true)
        setScheduleInput("")
      }
    }
  }

  const handleScheduleSubmit = async () => {
    if (scheduleInput.trim() && studyGoals.trim()) {
      try {
        const newEvents = []
        let eventId = events.length + 1
        const colors = ["cyan", "blue", "green", "purple", "orange", "pink", "indigo", "teal"]
        const classColors = ["blue", "indigo", "purple"]

        // Convert 12-hour to 24-hour format
        const convertTo24Hour = (time12h) => {
          const [time, period] = time12h.trim().split(" ")
          let [hours, minutes] = time.split(":")
          let hour = parseInt(hours)

          if (period === "PM" && hour !== 12) {
            hour += 12
          } else if (period === "AM" && hour === 12) {
            hour = 0
          }

          return `${hour.toString().padStart(2, "0")}:${minutes}`
        }

        // Step 1: Add class schedule directly to calendar (no AI modification)
        const classTimes = scheduleInput.split("\n").filter((line) => line.trim())
        const dayMap = { "Mon": 2, "Tue": 3, "Wed": 4, "Thu": 5, "Fri": 6, "Sat": 7, "Sun": 1 }

        classTimes.forEach((classTime) => {
          // Parse format: "Mon 9:30 AM - 10:45 AM - CS 3080 - Hayes Hall 117"
          const parts = classTime.split(" - ")
          if (parts.length >= 2) {
            const dayAndStartTime = parts[0].split(" ")
            const dayAbbr = dayAndStartTime[0]
            const startTime = dayAndStartTime.slice(1).join(" ")
            const endTime = parts[1]
            const courseName = parts.length >= 3 ? parts[2] : "Class"
            const location = parts.length >= 4 ? parts[3] : ""

            if (dayMap[dayAbbr]) {
              newEvents.push({
                id: eventId++,
                title: courseName,
                startTime: convertTo24Hour(startTime),
                endTime: convertTo24Hour(endTime),
                color: classColors[eventId % classColors.length],
                day: dayMap[dayAbbr],
                description: `Class from ${uploadedFileName}`,
                location: location || "TBD",
                attendees: [],
                organizer: "University",
              })
            }
          }
        })

        // Step 2: Send to AI to generate ONLY study sessions based on goals
        const response = await fetch("http://localhost:3001/schedule", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            classTimes: classTimes,
            studyGoals: studyGoals,
          }),
        })

        if (response.ok) {
          const scheduleData = await response.json()

          // Add AI-generated study sessions (avoiding class times)
          Object.keys(scheduleData).forEach((dayName, dayIndex) => {
            const daySchedule = scheduleData[dayName]
            Object.keys(daySchedule).forEach((timeSlot) => {
              const task = daySchedule[timeSlot]
              // Only add if it's NOT a class (classes already added above)
              const isClass = classTimes.some(ct => daySchedule[timeSlot].includes(ct.split(" - ")[2]))
              if (task && task.trim() !== "" && task !== "-" && !isClass) {
                const [startTime, endTime] = timeSlot.split(" - ")

                newEvents.push({
                  id: eventId++,
                  title: task,
                  startTime: convertTo24Hour(startTime),
                  endTime: convertTo24Hour(endTime),
                  color: colors[eventId % colors.length],
                  day: dayIndex + 2, // Monday = 2, Tuesday = 3, etc.
                  description: `AI Study Session`,
                  location: "Study",
                  attendees: [],
                  organizer: "You",
                })
              }
            })
          })

          setEvents([...events, ...newEvents])
          setShowSchedulePopup(false)
          setScheduleInput("")
          setStudyGoals("")
        } else {
          console.error("Failed to generate schedule")
        }
      } catch (error) {
        console.error("Error generating schedule:", error)
      }
    }
  }

  const handleDayClick = (day) => {
    if (day) {
      setSelectedDay(day)
      setCurrentDate(`March ${day}`)
      setCurrentView("day")
    }
  }

  const handleDragStart = (e, event) => {
    setDraggedEvent(event)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e, dayIndex) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverDay(dayIndex)
  }

  const handleDragLeave = () => {
    setDragOverDay(null)
  }

  const handleDrop = (e, newDay, newTime) => {
    e.preventDefault()
    if (draggedEvent) {
      setEvents((prevEvents) =>
        prevEvents.map((event) => (event.id === draggedEvent.id ? { ...event, day: newDay } : event)),
      )
      setDraggedEvent(null)
      setDragOverDay(null)
    }
  }

  const formatTimeDisplay = (hour) => {
    if (hour === 0) return "12 AM"
    if (hour < 12) return `${hour} AM`
    if (hour === 12) return "12 PM"
    return `${hour - 12} PM`
  }

  return (
    <div className="min-h-screen w-full bg-white dark:bg-gray-950 transition-colors">
      <header className="border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 py-3 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-3">
          <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 transition-colors" />
          <span className="text-lg font-medium text-gray-900 dark:text-gray-100">Calendar</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search events"
              className="rounded-md bg-gray-50 dark:bg-gray-900 pl-9 pr-4 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-700 focus:border-gray-300 dark:focus:border-gray-700 transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
            />
          </div>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {isDarkMode ? (
              <Sun className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <Moon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
          <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400 cursor-pointer transition-all hover:text-gray-900 dark:hover:text-gray-100 hover:rotate-90 duration-300" />
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-medium cursor-pointer hover:shadow-md transition-shadow">
            U
          </div>
        </div>
      </header>

      <main className="flex h-[calc(100vh-57px)]">
        <div className="w-60 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 flex flex-col overflow-y-auto">
          <div className="mb-6">
            <label
              htmlFor="pdf-upload"
              className="flex items-center justify-center gap-2 rounded-md bg-blue-500 px-3 py-2 text-sm font-medium text-white cursor-pointer transition-all hover:bg-blue-600"
            >
              <Upload className="h-4 w-4" />
              <span>Upload PDF</span>
            </label>
            <input id="pdf-upload" type="file" accept="application/pdf" onChange={handlePDFUpload} className="hidden" />
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{currentMonth}</h3>
              <div className="flex gap-1">
                <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </button>
                <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                <div key={i} className="text-xs text-gray-500 dark:text-gray-400 font-medium py-1">
                  {day}
                </div>
              ))}

              {miniCalendarDays.map((day, i) => (
                <div
                  key={i}
                  onClick={() => handleDayClick(day)}
                  className={`text-xs rounded-md w-7 h-7 flex items-center justify-center cursor-pointer transition-all ${
                    day === selectedDay
                      ? "bg-blue-500 text-white font-medium"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  } ${!day ? "invisible" : ""}`}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-950">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">My calendars</h3>
            <div className="space-y-1">
              {myCalendars.map((cal, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-900 p-1.5 rounded-md"
                >
                  <div className={`w-2.5 h-2.5 rounded-sm ${cal.color}`}></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{cal.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-white dark:bg-gray-950">
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <button className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md transition-all hover:bg-gray-50 dark:hover:bg-gray-800">
                Today
              </button>
              <div className="flex">
                <button className="p-1.5 text-gray-600 dark:text-gray-400 rounded-l-md transition-all hover:bg-gray-100 dark:hover:bg-gray-800">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button className="p-1.5 text-gray-600 dark:text-gray-400 rounded-r-md transition-all hover:bg-gray-100 dark:hover:bg-gray-800">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <h2 className="text-base font-medium text-gray-900 dark:text-gray-100">{currentDate}</h2>
            </div>

            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 rounded-md p-0.5">
              <button
                onClick={() => setCurrentView("day")}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${currentView === "day" ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"}`}
              >
                Day
              </button>
              <button
                onClick={() => setCurrentView("week")}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${currentView === "week" ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"}`}
              >
                Week
              </button>
              <button
                onClick={() => setCurrentView("month")}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${currentView === "month" ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"}`}
              >
                Month
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <div className="h-full">
              {currentView === "day" && (
                <>
                  <div className="grid grid-cols-[60px_1fr] border-b border-gray-200 dark:border-gray-800">
                    <div className="p-2"></div>
                    <div className="p-2 text-center border-l border-gray-200 dark:border-gray-800">
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        {weekDays[weekDates.indexOf(selectedDay)]}
                      </div>
                      <div className="text-lg font-medium mt-1 text-white bg-blue-500 rounded-full w-7 h-7 flex items-center justify-center mx-auto text-sm">
                        {selectedDay}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-[60px_1fr]">
                    <div className="text-gray-500 dark:text-gray-400">
                      {timeSlots.map((time, i) => (
                        <div
                          key={i}
                          className="h-20 border-b border-gray-100 dark:border-gray-900 pr-2 text-right text-xs pt-1"
                        >
                          {formatTimeDisplay(time)}
                        </div>
                      ))}
                    </div>

                    <div
                      className={`border-l border-gray-200 dark:border-gray-800 relative transition-colors ${
                        dragOverDay === getSelectedDayIndex() ? "bg-blue-50 dark:bg-blue-950/20" : ""
                      }`}
                      onDragLeave={handleDragLeave}
                    >
                      {timeSlots.map((time, timeIndex) => (
                        <div
                          key={timeIndex}
                          className="h-20 border-b border-gray-100 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                          onDragOver={(e) => handleDragOver(e, getSelectedDayIndex())}
                          onDrop={(e) => handleDrop(e, getSelectedDayIndex(), time)}
                        ></div>
                      ))}

                      {events
                        .filter((event) => event.day === getSelectedDayIndex())
                        .map((event, i) => {
                          const eventStyle = calculateEventStyle(event.startTime, event.endTime)
                          return (
                            <div
                              key={i}
                              draggable
                              onDragStart={(e) => handleDragStart(e, event)}
                              className={`absolute ${getEventClasses(event.color)} rounded-md p-2.5 text-xs cursor-move transition-all hover:shadow-md`}
                              style={{
                                ...eventStyle,
                                left: "8px",
                                right: "8px",
                              }}
                              onClick={() => handleEventClick(event)}
                            >
                              <div className="font-semibold truncate">{event.title}</div>
                              <div className="opacity-80 text-[11px] mt-1">{`${event.startTime} - ${event.endTime}`}</div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                </>
              )}

              {currentView === "week" && (
                <>
                  <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200 dark:border-gray-800">
                    <div className="p-2"></div>
                    {weekDays.map((day, i) => (
                      <div key={i} className="p-2 text-center border-l border-gray-200 dark:border-gray-800">
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{day}</div>
                        <div
                          className={`text-base font-medium mt-1 ${weekDates[i] === selectedDay ? "text-white bg-blue-500 rounded-full w-7 h-7 flex items-center justify-center mx-auto text-sm" : "text-gray-900 dark:text-gray-100"}`}
                        >
                          {weekDates[i]}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-[60px_repeat(7,1fr)]">
                    <div className="text-gray-500 dark:text-gray-400">
                      {timeSlots.map((time, i) => (
                        <div
                          key={i}
                          className="h-20 border-b border-gray-100 dark:border-gray-900 pr-2 text-right text-xs pt-1"
                        >
                          {formatTimeDisplay(time)}
                        </div>
                      ))}
                    </div>

                    {Array.from({ length: 7 }).map((_, dayIndex) => (
                      <div
                        key={dayIndex}
                        className={`border-l border-gray-200 dark:border-gray-800 relative transition-colors ${
                          dragOverDay === dayIndex + 1 ? "bg-blue-50 dark:bg-blue-950/20" : ""
                        }`}
                        onDragLeave={handleDragLeave}
                      >
                        {timeSlots.map((time, timeIndex) => (
                          <div
                            key={timeIndex}
                            className="h-20 border-b border-gray-100 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                            onDragOver={(e) => handleDragOver(e, dayIndex + 1)}
                            onDrop={(e) => handleDrop(e, dayIndex + 1, time)}
                          ></div>
                        ))}

                        {events
                          .filter((event) => event.day === dayIndex + 1)
                          .map((event, i) => {
                            const eventStyle = calculateEventStyle(event.startTime, event.endTime)
                            return (
                              <div
                                key={i}
                                draggable
                                onDragStart={(e) => handleDragStart(e, event)}
                                className={`absolute ${getEventClasses(event.color)} rounded-md p-2 text-xs cursor-move transition-all hover:shadow-md`}
                                style={{
                                  ...eventStyle,
                                  left: "4px",
                                  right: "4px",
                                }}
                                onClick={() => handleEventClick(event)}
                              >
                                <div className="font-semibold truncate">{event.title}</div>
                                <div className="opacity-80 text-[10px] mt-0.5">{`${event.startTime} - ${event.endTime}`}</div>
                              </div>
                            )
                          })}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {currentView === "month" && (
                <>
                  <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800">
                    {weekDays.map((day, i) => (
                      <div
                        key={i}
                        className="p-2 text-center border-l border-gray-200 dark:border-gray-800 first:border-l-0"
                      >
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{day}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 h-full">
                    {miniCalendarDays.map((day, i) => {
                      const dayIndex = weekDates.indexOf(day) + 1
                      const dayEvents = events.filter((event) => event.day === dayIndex)

                      return (
                        <div
                          key={i}
                          onClick={() => handleDayClick(day)}
                          className={`border-l border-b border-gray-200 dark:border-gray-800 p-2 min-h-[100px] cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-900 ${
                            !day ? "invisible" : ""
                          } ${day === selectedDay ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}
                        >
                          {day && (
                            <>
                              <div className="text-sm text-gray-700 dark:text-gray-300 font-medium mb-1">{day}</div>
                              <div className="space-y-1">
                                {dayEvents.slice(0, 3).map((event, idx) => (
                                  <div
                                    key={idx}
                                    className={`${getEventClasses(event.color)} text-[10px] px-1.5 py-1 rounded truncate transition-all hover:shadow-sm cursor-pointer`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleEventClick(event)
                                    }}
                                  >
                                    {event.title}
                                  </div>
                                ))}
                                {dayEvents.length > 3 && (
                                  <div className="text-gray-500 dark:text-gray-400 text-[10px] px-1.5">
                                    +{dayEvents.length - 3} more
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {showSchedulePopup && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Schedule from PDF</h3>
              <button
                onClick={() => setShowSchedulePopup(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Uploaded: <span className="font-medium">{uploadedFileName}</span>
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Detected Class Schedule
              </label>
              <textarea
                value={scheduleInput}
                onChange={(e) => setScheduleInput(e.target.value)}
                placeholder="Your class times will appear here..."
                className="w-full h-24 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none"
                readOnly
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Study Goals & Priorities
              </label>
              <textarea
                value={studyGoals}
                onChange={(e) => setStudyGoals(e.target.value)}
                placeholder="E.g., Review math chapters, Practice coding problems, Prepare for physics exam, Complete project report..."
                className="w-full h-32 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                AI will create an optimized schedule based on your goals, avoiding class times and maximizing study efficiency
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSchedulePopup(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleSubmit}
                disabled={!scheduleInput.trim() || !studyGoals.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Generate AI Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {showAIPopup && (
        <div className="fixed bottom-6 right-6 z-20">
          <div className="w-[400px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg p-4">
            <button
              onClick={() => setShowAIPopup(false)}
              className="absolute top-2 right-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <Sparkles className="h-5 w-5 text-blue-500" />
              </div>
              <div className="min-h-[60px]">
                <p className="text-sm text-gray-700 dark:text-gray-300">{typedText}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={togglePlay}
                className="flex-1 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setShowAIPopup(false)}
                className="flex-1 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                No
              </button>
            </div>
            {isPlaying && (
              <div className="mt-3">
                <button
                  className="flex items-center justify-center gap-2 rounded-md bg-gray-100 dark:bg-gray-800 px-3 py-2 text-gray-700 dark:text-gray-300 text-sm w-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  onClick={togglePlay}
                >
                  <Pause className="h-4 w-4" />
                  <span>Pause Hans Zimmer</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">{selectedEvent.title}</h3>
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <p className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                {`${selectedEvent.startTime} - ${selectedEvent.endTime}`}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                {selectedEvent.location}
              </p>
              <p className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5" />
                {`${weekDays[selectedEvent.day - 1]}, ${weekDates[selectedEvent.day - 1]} ${currentMonth}`}
              </p>
              <p className="flex items-start gap-2">
                <Users className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5" />
                <span>
                  <strong className="font-medium">Attendees:</strong>
                  <br />
                  {selectedEvent.attendees.join(", ") || "No attendees"}
                </span>
              </p>
              <p>
                <strong className="font-medium">Organizer:</strong> {selectedEvent.organizer}
              </p>
              <p>
                <strong className="font-medium">Description:</strong> {selectedEvent.description}
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                onClick={() => setSelectedEvent(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
