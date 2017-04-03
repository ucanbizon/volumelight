#version 330 core
out vec4 color;
uniform vec3 occ_Color;
void main()
{
    color = vec4(occ_Color, 1.0f); // Set alle 4 vector values to 1.0f
}