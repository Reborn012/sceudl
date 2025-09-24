import React, { useState } from "react";
import axios from "axios";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
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
];

export default function App() {
  const [classTimes, setClassTimes] = useState("");
  const [studyGoals, setStudyGoals] = useState("");
  const [schedule, setSchedule] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    setSchedule(null);

    try {
      const res = await axios.post("http://localhost:3000/schedule", {
        classTimes: classTimes.split("\n").map((line) => line.trim()).filter(Boolean),
        studyGoals,
      });
      setSchedule(res.data);
    } catch (err) {
      console.error("❌ Error fetching schedule:", err);
      setError("Error generating schedule. Check backend logs.");
    }
  };

  return (
    <div style={{ padding: "20px", color: "white", fontFamily: "Arial" }}>
      <h1>📅 AI Study Scheduler</h1>

      <div>
        <label>Class Times (one per line):</label>
        <br />
        <textarea
          value={classTimes}
          onChange={(e) => setClassTimes(e.target.value)}
          rows={3}
          cols={50}
          placeholder="Example: Mon 10:30 - 11:30"
        />
      </div>

      <div style={{ marginTop: "10px" }}>
        <label>Study Goals (comma separated):</label>
        <br />
        <textarea
          value={studyGoals}
          onChange={(e) => setStudyGoals(e.target.value)}
          rows={3}
          cols={50}
          placeholder="Example: Finish math homework, Read history chapter"
        />
      </div>

      <button
        style={{
          marginTop: "10px",
          padding: "10px",
          backgroundColor: "green",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
        onClick={handleSubmit}
      >
        Generate Schedule
      </button>

      {error && (
        <div style={{ color: "red", marginTop: "10px" }}>
          {error}
        </div>
      )}

      {schedule && (
        <div style={{ marginTop: "20px" }}>
          <h2>✅ Generated Schedule</h2>
          <table
            style={{
              borderCollapse: "collapse",
              width: "90%",
              margin: "auto",
              textAlign: "center",
            }}
          >
            <thead>
              <tr>
                <th style={{ border: "1px solid white", padding: "8px" }}>Time</th>
                {days.map((day) => (
                  <th
                    key={day}
                    style={{ border: "1px solid white", padding: "8px" }}
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {times.map((time) => (
                <tr key={time}>
                  <td style={{ border: "1px solid white", padding: "8px" }}>{time}</td>
                  {days.map((day) => (
                    <td
                      key={day + time}
                      style={{ border: "1px solid white", padding: "8px" }}
                    >
                      {schedule[day] && schedule[day][time]
                        ? schedule[day][time]
                        : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
