import { Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const RegistrationPromo = ({ onSignInClick }) => {
    const { user } = useAuth();

    if (user) return null;

    return (
        <div className="registration-promo">
            <div className="promo-icon">
                <Heart size={24} fill="white" color="white" />
            </div>
            <h3>Know a hidden gem?</h3>
            <p>Sign in to add resources and help your community find what they need.</p>
            <button className="promo-btn" onClick={onSignInClick}>
                Sign In to Contribute
            </button>
        </div>
    );
};

export default RegistrationPromo;
