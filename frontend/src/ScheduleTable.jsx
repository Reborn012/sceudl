import React from "react";

const timeSlots = [
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

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function ScheduleTable({ schedule }) {
  return (
    <table className="schedule-table">
      <thead>
        <tr>
          <th>Time</th>
          {days.map((day) => (
            <th key={day}>{day}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {timeSlots.map((slot) => (
          <tr key={slot}>
            <td>{slot}</td>
            {days.map((day) => (
              <td key={day + slot}>
                {schedule?.[day]?.[slot] || ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
