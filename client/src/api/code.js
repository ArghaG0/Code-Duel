import axios from 'axios';

export async function postCode(path, body, onAuthRequired) {
    const token = localStorage.getItem('token');
    const requireLogin = () => {
        localStorage.removeItem('token');
        onAuthRequired('Your session is missing or expired. Please sign in to run or submit code.');
        return null;
    };
    if (!token) return requireLogin();

    try {
        return await axios.post(path, body, {
            headers: { Authorization: `Bearer ${token}` }
        });
    } catch (error) {
        if (error.response?.status === 401) return requireLogin();
        throw error;
    }
}
