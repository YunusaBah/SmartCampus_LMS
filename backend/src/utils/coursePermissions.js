const COURSE_PERMISSIONS = [
    "uploadMaterials",
    "createAssignments",
    "gradeAssignments",
    "postAnnouncements"
];

const COURSE_PERMISSION_ROLES = ["student_assistant", "class_representative"];

const normalizePermissions = (permissions, legacyAnnouncementPermission = false) => {
    const values = Array.isArray(permissions) ? permissions : [];
    const normalized = [...new Set(values.filter((permission) => COURSE_PERMISSIONS.includes(permission)))];
    if (legacyAnnouncementPermission && !normalized.includes("postAnnouncements")) {
        normalized.push("postAnnouncements");
    }
    return normalized;
};

const hasCoursePermission = (enrollment, permission) => {
    if (!enrollment || !COURSE_PERMISSIONS.includes(permission)) return false;
    return normalizePermissions(enrollment.permissions, enrollment.canPostAnnouncements).includes(permission);
};

module.exports = {
    COURSE_PERMISSIONS,
    COURSE_PERMISSION_ROLES,
    normalizePermissions,
    hasCoursePermission
};
