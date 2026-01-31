// Round to 2 decimals
export const round2 = (value) => {
    if (value === null || value === undefined || isNaN(value)) return 0;
    return Number(Number(value).toFixed(2));
};

export const round = (value) => {
    if (value === null || value === undefined || isNaN(value)) return 0;
    return Number(Number(Math.round(value)));
}

// Round to N decimals (generic)
export const roundN = (value, decimals = 2) => {
    if (value === null || value === undefined || isNaN(value)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
};

// Safe divide with rounding
export const divideAndRound = (total, parts, decimals = 2) => {
    if (!parts || isNaN(parts)) return 0;
    return roundN(total / parts, decimals);
};