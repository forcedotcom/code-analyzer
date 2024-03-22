LoadCSSApexStylesheet[](#loadcssapexstylesheet)
------------------------------------------------------------------------------------------------------------------------------------------------------

**Violation:**

   Load JavaScript only from static resources.


**Priority:** High (2)

**Description:**

   Determines where CSS must be loaded as a static resource

**Example(s):**

   

```
<apex:stylesheet value="{!$Resource.mycssresource}"/>
```

See more examples on properly using static resources here: https://developer.salesforce.com/docs/atlas.en-us.236.0.secure_coding_guide.meta/secure_coding_guide/secure_coding_cross_site_scripting.htm

        

