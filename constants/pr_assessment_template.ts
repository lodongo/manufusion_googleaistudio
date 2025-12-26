
// FIX: Populated defaultAssessmentTemplate to provide seed data and resolve property access errors on an empty object.
export const defaultAssessmentTemplate = {
    scale_min: 1,
    scale_max: 5,
    scale_definition: '1 = Poor, 2 = Below Average, 3 = Average, 4 = Good, 5 = Excellent',
    categories: [
        {
            name: 'Quality Management Systems',
            weight_percent: 25,
            description: 'Assesses the robustness of the supplier\'s quality control processes and certifications.',
            questions: [
                {
                    question_text: 'Does the supplier hold current, relevant quality certifications (e.g., ISO 9001)?',
                    question_type: 'strategic',
                    scores: 'both',
                    rating_scale: {
                        "1": "No certifications.",
                        "2": "Certification expired or not relevant.",
                        "3": "Holds basic, relevant certification.",
                        "4": "Holds multiple relevant certifications.",
                        "5": "Holds advanced/industry-leading certifications and demonstrates strong internal quality culture."
                    }
                },
                {
                    question_text: 'What is the process for handling non-conforming products?',
                    question_type: 'situational',
                    scores: 'both',
                    rating_scale: {
                        "1": "No formal process.",
                        "2": "Reactive process, poorly documented.",
                        "3": "Documented corrective action process.",
                        "4": "Proactive root cause analysis and corrective/preventive action (CAPA) process.",
                        "5": "Integrated CAPA process with closed-loop feedback and continuous improvement."
                    }
                }
            ]
        },
        {
            name: 'Delivery and Logistics',
            weight_percent: 25,
            description: 'Evaluates on-time delivery performance, logistical capabilities, and supply chain reliability.',
            questions: [
                {
                    question_text: 'What is the supplier\'s On-Time In-Full (OTIF) delivery performance percentage over the last 12 months?',
                    question_type: 'strategic',
                    scores: 'supplier',
                    rating_scale: {
                        "1": "< 85%",
                        "2": "85% - 90%",
                        "3": "90% - 95%",
                        "4": "95% - 98%",
                        "5": "> 98%"
                    }
                },
                {
                    question_text: 'How does the supplier manage supply chain disruptions or demand volatility?',
                    question_type: 'situational',
                    scores: 'organisation',
                    rating_scale: {
                        "1": "No clear strategy, purely reactive.",
                        "2": "Basic communication of delays.",
                        "3": "Maintains safety stock, has some backup plans.",
                        "4": "Proactive monitoring, dual-sourcing for critical components, documented contingency plans.",
                        "5": "Advanced supply chain visibility, predictive analytics, and highly resilient network."
                    }
                }
            ]
        },
        {
            name: 'Cost and Competitiveness',
            weight_percent: 20,
            description: 'Assesses pricing, financial stability, and willingness to work on cost-reduction initiatives.',
            questions: [
                {
                    question_text: 'How competitive is the supplier\'s pricing compared to the market average?',
                    question_type: 'strategic',
                    scores: 'organisation',
                    rating_scale: {
                        "1": "Significantly higher than market.",
                        "2": "Slightly higher than market.",
                        "3": "At market average.",
                        "4": "Slightly below market average.",
                        "5": "Significantly below market average / market leader."
                    }
                },
                {
                    question_text: 'Is the supplier financially stable?',
                    question_type: 'strategic',
                    scores: 'both',
                    rating_scale: {
                        "1": "High risk of insolvency, poor credit rating.",
                        "2": "Unstable, negative financial trends.",
                        "3": "Stable, but with some financial concerns.",
                        "4": "Financially sound with positive trends.",
                        "5": "Very strong financial position, excellent credit rating."
                    }
                }
            ]
        },
        {
            name: 'Technical Capability & Innovation',
            weight_percent: 15,
            description: 'Evaluates the supplier\'s technical expertise, R&D capabilities, and potential for future collaboration.',
            questions: [
                {
                    question_text: 'Does the supplier demonstrate technical expertise and provide support?',
                    question_type: 'situational',
                    scores: 'organisation',
                    rating_scale: {
                        "1": "No technical support available.",
                        "2": "Limited or slow technical support.",
                        "3": "Adequate technical support available on request.",
                        "4": "Proactive technical support and collaboration.",
                        "5": "Industry-leading expertise, acts as a technical partner."
                    }
                }
            ]
        },
        {
            name: 'Sustainability and Compliance (ESG)',
            weight_percent: 15,
            description: 'Assesses the supplier\'s commitment to environmental, social, and governance standards.',
            questions: [
                {
                    question_text: 'Does the supplier have documented policies for environmental and social responsibility?',
                    question_type: 'strategic',
                    scores: 'both',
                    rating_scale: {
                        "1": "No policies.",
                        "2": "Basic statement but no evidence of implementation.",
                        "3": "Has policies and some evidence of practice.",
                        "4": "Certified systems (e.g., ISO 14001) and regular reporting.",
                        "5": "Leader in sustainability with public reporting and clear targets."
                    }
                }
            ]
        }
    ]
};
