import React from 'react';
import { Helmet } from 'react-helmet-async';

const StructuredData = ({ resources }) => {
    const organizationSchema = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "HumanAid",
        "url": window.location.origin,
        "logo": `${window.location.origin}/heart-icon.svg`,
        "description": "Connecting people in need with local humanitarian resources.",
        "sameAs": []
    };

    const resourceSchema = resources.map(resource => ({
        "@context": "https://schema.org",
        "@type": "CivicStructure",
        "name": resource.name,
        "address": {
            "@type": "PostalAddress",
            "streetAddress": resource.address,
            "addressLocality": resource.city,
            "addressRegion": resource.state,
            "postalCode": resource.zip_code,
            "addressCountry": "US"
        },
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": resource.latitude,
            "longitude": resource.longitude
        },
        "telephone": resource.phone,
        "url": resource.website,
        "description": resource.description
    }));

    return (
        <Helmet>
            <script type="application/ld+json">
                {JSON.stringify(organizationSchema)}
            </script>
            {resources.length > 0 && (
                <script type="application/ld+json">
                    {JSON.stringify(resourceSchema)}
                </script>
            )}
        </Helmet>
    );
};

export default StructuredData;
