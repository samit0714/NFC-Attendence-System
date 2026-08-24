package com.samit.nfc_attendence.repository;

import com.samit.nfc_attendence.models.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface AttendanceRepository extends JpaRepository<Attendance, Long> {
    List<Attendance> findBySubjectIdAndAttendanceDate(Long subjectId, LocalDate attendanceDate);
    
    // Overall status count ke liye
    long countByStatus(String status);
    
    // Subject-wise advanced stats count ke liye
    long countBySubjectIdAndStatus(Long subjectId, String status);
}