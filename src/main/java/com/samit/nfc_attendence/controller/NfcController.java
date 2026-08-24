package com.samit.nfc_attendence.controller;

import com.samit.nfc_attendence.models.Attendance;
import com.samit.nfc_attendence.models.Timetable;
import com.samit.nfc_attendence.repository.AttendanceRepository;
import com.samit.nfc_attendence.repository.TimetableRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api")
public class NfcController {

    @Autowired
    private TimetableRepository timetableRepository;

    @Autowired
    private AttendanceRepository attendanceRepository;

    @GetMapping("/today-schedule")
    public List<Map<String, Object>> getTodaysSchedule() {
        String today = LocalDate.now().getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.ENGLISH); 
        
        //String today = "Tuesday"; 
        
        List<Timetable> schedule = timetableRepository.findByDayOfWeekIgnoreCaseOrderByStartTimeAsc(today);
        List<Map<String, Object>> advancedSchedule = new ArrayList<>();
        
        for (Timetable t : schedule) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", t.getId());
            map.put("subjectName", t.getSubjectName());
            map.put("classType", t.getClassType());
            map.put("targetBatch", t.getTargetBatch());
            map.put("startTime", t.getStartTime());
            map.put("endTime", t.getEndTime());
            
            long present = attendanceRepository.countBySubjectIdAndStatus(t.getId(), "Present");
            long absent = attendanceRepository.countBySubjectIdAndStatus(t.getId(), "Absent");
            long held = present + absent;
            double perc = held > 0 ? ((double) present / held) * 100 : 0.0;
            long needed = Math.max(0, (3 * held) - (4 * present));
            
            map.put("attended", present);
            map.put("held", held);
            map.put("percentage", Math.round(perc * 10.0) / 10.0);
            map.put("needed", needed);
            
            List<Attendance> todayAtt = attendanceRepository.findBySubjectIdAndAttendanceDate(t.getId(), LocalDate.now());
            map.put("todayStatus", todayAtt.isEmpty() ? null : todayAtt.get(0).getStatus());
            
            advancedSchedule.add(map);
        }
        return advancedSchedule;
    }

    @PostMapping("/mark-attendance")
    public String markAttendance(@RequestParam Long subjectId, @RequestParam String status) {
        LocalDate today = LocalDate.now();
        List<Attendance> existingRecord = attendanceRepository.findBySubjectIdAndAttendanceDate(subjectId, today);
        if (!existingRecord.isEmpty()) {
            Attendance att = existingRecord.get(0);
            att.setStatus(status);
            attendanceRepository.save(att);
            return "Attendance updated to " + status;
        }

        Attendance attendance = new Attendance();
        attendance.setSubjectId(subjectId);
        attendance.setAttendanceDate(today);
        attendance.setStatus(status);
        attendanceRepository.save(attendance);
        return "Attendance marked successfully as " + status;
    }

    @GetMapping("/stats")
    public Map<String, Object> getStats() {
        long totalPresent = attendanceRepository.countByStatus("Present");
        long totalAbsent = attendanceRepository.countByStatus("Absent");
        long totalHeld = totalPresent + totalAbsent; 
        
        double percentage = 0.0;
        if (totalHeld > 0) {
            percentage = ((double) totalPresent / totalHeld) * 100;
        }
        
        long classesNeeded = (3 * totalHeld) - (4 * totalPresent);
        if (classesNeeded < 0) classesNeeded = 0;
        
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalHeld", totalHeld);
        stats.put("totalPresent", totalPresent);
        stats.put("percentage", Math.round(percentage * 10.0) / 10.0);
        stats.put("classesNeededFor75", classesNeeded);
        return stats;
    }

    @GetMapping("/predict")
    public Map<String, Object> predictAttendance(@RequestParam String startDate, @RequestParam String endDate) {
        LocalDate start = LocalDate.parse(startDate);
        LocalDate end = LocalDate.parse(endDate);
        
        long futureClasses = 0;
        LocalDate current = start;
        while (!current.isAfter(end)) {
            String dayName = current.getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.ENGLISH);
            futureClasses += timetableRepository.findByDayOfWeekIgnoreCaseOrderByStartTimeAsc(dayName).size();
            current = current.plusDays(1);
        }
        
        long totalPresent = attendanceRepository.countByStatus("Present");
        long totalAbsent = attendanceRepository.countByStatus("Absent");
        long totalHeld = totalPresent + totalAbsent;
        
        long newTotalHeld = totalHeld + futureClasses;
        long newTotalPresent = totalPresent + futureClasses;
        
        double newPercentage = 0.0;
        if (newTotalHeld > 0) {
            newPercentage = ((double) newTotalPresent / newTotalHeld) * 100;
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("futureClassesCount", futureClasses);
        result.put("predictedPercentage", Math.round(newPercentage * 10.0) / 10.0);
        result.put("is75Possible", newPercentage >= 75.0);
        return result;
    }

    @GetMapping("/all-schedule")
    public List<Timetable> getAllSchedule() {
        return timetableRepository.findAll();
    }

    // 🌟 THE MISSING API: Subject Analytics Report
    @GetMapping("/all-subjects-stats")
    public List<Map<String, Object>> getAllSubjectsStats() {
        List<Timetable> allSlots = timetableRepository.findAll();
        List<Attendance> allAtt = attendanceRepository.findAll();

        Map<String, List<Long>> subjectToSlotIds = new HashMap<>();
        for(Timetable t : allSlots) {
            subjectToSlotIds.putIfAbsent(t.getSubjectName(), new ArrayList<>());
            subjectToSlotIds.get(t.getSubjectName()).add(t.getId());
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for(String subj : subjectToSlotIds.keySet()) {
            List<Long> slotIds = subjectToSlotIds.get(subj);
            long present = 0, absent = 0;
            for(Attendance a : allAtt) {
                if(slotIds.contains(a.getSubjectId())) {
                    if("Present".equals(a.getStatus())) present++;
                    if("Absent".equals(a.getStatus())) absent++;
                }
            }
            long held = present + absent;
            double perc = held > 0 ? ((double) present / held) * 100 : 0.0;
            long needed = Math.max(0, (3 * held) - (4 * present));
            
            long safeBunks = 0;
            if(held > 0 && perc >= 75) {
                safeBunks = (long) Math.floor((present / 0.75) - held);
            }

            Map<String, Object> map = new HashMap<>();
            map.put("subjectName", subj);
            map.put("attended", present);
            map.put("held", held);
            map.put("percentage", Math.round(perc * 10.0) / 10.0);
            map.put("needed", needed);
            map.put("safeBunks", safeBunks);
            result.add(map);
        }
        return result;
    }

    @DeleteMapping("/reset-attendance")
    public String resetAttendance() {
        attendanceRepository.deleteAll();
        return "System Reset Successful! Ready for new phase.";
    }
}