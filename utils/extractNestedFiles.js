export default function extractFiles(files = []) {
    const result = {};

    for (const file of files) {
        const field = file.fieldname;
        const filePath = file.path.replace(/\\/g, "/");

        const tokens = field.includes("[")
            ? field.match(/([^\[\]]+)/g)
            : field.split(".");

        let current = result;

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const isLast = i === tokens.length - 1;

            if (/^\d+$/.test(token)) {
                const index = Number(token);

                if (!Array.isArray(current)) {
                    const parentKey = tokens[i - 1];
                    current[parentKey] = [];
                    current = current[parentKey];
                }

                if (!current[index]) current[index] = {};

                if (isLast) {
                    return;
                } else {
                    current = current[index];
                }
            } else {
                if (isLast) {
                    const parentIndex = findParentIndex(tokens);

                    current[token] = {
                        path: filePath,
                        index: parentIndex
                    };
                } else {
                    if (!current[token]) {
                        if (/^\d+$/.test(tokens[i + 1])) {
                            current[token] = [];
                        } else {
                            current[token] = {};
                        }
                    }
                    current = current[token];
                }
            }
        }
    }

    return result;
}

function findParentIndex(tokens) {
    const reversed = [...tokens].reverse();
    for (const t of reversed) {
        if (/^\d+$/.test(t)) return Number(t);
    }
    return null;
}
