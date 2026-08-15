import { ResumeContent } from '../../models/resume.model';

/** A structurally complete, empty resume content for repository specs. */
export const emptyContent: ResumeContent = {
  contacts: {
    fullName: '',
    title: '',
    email: '',
    phone: '',
    location: '',
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: '',
  },
  summary: '',
  skills: [],
  experiences: [],
  projects: [],
  education: [],
  certifications: [],
  awards: [],
  achievements: [],
  languages: [],
  customSections: [],
};
