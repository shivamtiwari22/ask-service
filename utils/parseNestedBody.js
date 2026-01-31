const parseNestedBody = (body) => {
    const result = {};
    for (const [key, value] of Object.entries(body)) {
        const cleanedValue =
            typeof value === "string" ? value.replace(/:$/, "") : value;
        const parts = key.split(".");
        let current = result;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const arrayMatch = part.match(/(\w+)\[(\d+)\]/);
            if (arrayMatch) {
                const [_, arrayKey, indexStr] = arrayMatch;
                const index = parseInt(indexStr, 10);
                if (!current[arrayKey]) current[arrayKey] = [];
                if (!current[arrayKey][index]) current[arrayKey][index] = {};
                if (i === parts.length - 1) {
                    current[arrayKey][index] = cleanedValue;
                } else {
                    current = current[arrayKey][index];
                }
            } else {
                if (i === parts.length - 1) {
                    current[part] = cleanedValue;
                } else {
                    current[part] = current[part] || {};
                    current = current[part];
                }
            }
        }
    }
    return result;
};


export default parseNestedBody;